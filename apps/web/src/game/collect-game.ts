import Matter from "matter-js";
import * as PIXI from "pixi.js";

import { GameAudio } from "@/game/audio";
import {
  aimDirection,
  computeEnemyTarget,
  ENEMY_DEFAULT_SPEED,
  ENEMY_DEFAULT_VISION_RANGE,
  ENEMY_SHOOT_INTERVAL_MS,
  jumpOffset,
  patrolOffset,
  PROJECTILE_LIFETIME_MS,
  PROJECTILE_SIZE,
  PROJECTILE_SPEED,
  shouldShoot,
} from "@/game/enemy-ai";
import type { GameEngine, GameEngineCallbacks, GameEngineOptions } from "@/game/game-engine";
import { LEVEL_HEIGHT, LEVEL_WIDTH } from "@/game/level-constants";
import type { EnemyBehavior, PowerupType, SceneConfig } from "@/lib/scene-config-builder";

const WALL_THICKNESS = 12;
const PLAYER_RADIUS = 18;
const MOVE_SPEED = 4;
const COIN_RADIUS = 14;
const POWERUP_RADIUS = 16;
const OBSTACLE_SIZE = 36;
const MIN_SPAWN_DISTANCE = 60;
const TIME_LIMIT_SECONDS = 60;
const START_LIVES = 3;
const INVULNERABILITY_MS = 1000;
const SHIELD_DURATION_MS = 5000;
const DOUBLE_COINS_DURATION_MS = 8000;
const DEFAULT_SKY_COLOR = 0x0f766e;

const POWERUP_COLORS: Record<PowerupType, number> = {
  extra_life: 0xef4444,
  shield: 0x60a5fa,
  double_coins: 0xffc736,
};

type Direction = "left" | "right" | "up" | "down" | null;

function parseSkyColor(sky?: string): number {
  if (!sky) return DEFAULT_SKY_COLOR;
  const parsed = Number.parseInt(sky.replace("#", ""), 16);
  return Number.isNaN(parsed) ? DEFAULT_SKY_COLOR : parsed;
}

/** Sorteia uma posição livre na arena, evitando sobrepor o que já foi colocado. */
function randomPosition(taken: { x: number; y: number }[], margin: number): { x: number; y: number } {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const x = margin + Math.random() * (LEVEL_WIDTH - margin * 2);
    const y = margin + Math.random() * (LEVEL_HEIGHT - margin * 2);
    if (taken.every((p) => Math.hypot(p.x - x, p.y - y) >= MIN_SPAWN_DISTANCE)) {
      return { x, y };
    }
  }
  // Desiste de evitar sobreposição depois de várias tentativas - melhor ter o
  // elemento em algum lugar do que travar tentando achar um espaço perfeito.
  return {
    x: margin + Math.random() * (LEVEL_WIDTH - margin * 2),
    y: margin + Math.random() * (LEVEL_HEIGHT - margin * 2),
  };
}

export class CollectGame implements GameEngine {
  private app: PIXI.Application;
  private engine: Matter.Engine;
  private sceneConfig: SceneConfig;
  private callbacks: GameEngineCallbacks;
  private texture: PIXI.Texture;
  private audio = new GameAudio();

  private worldObjects: Matter.Body[] = [];
  private worldGraphics: PIXI.Container[] = [];

  private playerBody!: Matter.Body;
  private playerSprite!: PIXI.Sprite;
  private shieldGraphic!: PIXI.Graphics;
  private coinEntities: { body: Matter.Body; graphic: PIXI.Container }[] = [];
  private powerupEntities: { body: Matter.Body; graphic: PIXI.Container; type: PowerupType }[] = [];
  private destructibleEntities: { body: Matter.Body; graphic: PIXI.Container }[] = [];
  private enemyEntities: {
    body: Matter.Body;
    graphic: PIXI.Container;
    spawnX: number;
    spawnY: number;
    behavior: EnemyBehavior;
    speed: number;
    visionRange: number;
    phase: number;
    lastShotAt: number;
  }[] = [];
  private projectileEntities: { body: Matter.Body; graphic: PIXI.Container; spawnAt: number; vx: number; vy: number }[] =
    [];

  private direction: Direction = null;
  private invulnerableUntil = 0;
  private doubleCoinsUntil = 0;
  private isGameOver = false;
  private lives = START_LIVES;
  private coins = 0;
  private elapsedMs = 0;
  private lastReportedSecond = -1;

  private constructor(
    app: PIXI.Application,
    engine: Matter.Engine,
    texture: PIXI.Texture,
    sceneConfig: SceneConfig,
    callbacks: GameEngineCallbacks,
  ) {
    this.app = app;
    this.engine = engine;
    this.texture = texture;
    this.sceneConfig = sceneConfig;
    this.callbacks = callbacks;
  }

  static async create(options: GameEngineOptions): Promise<CollectGame> {
    const app = new PIXI.Application();
    await app.init({
      width: LEVEL_WIDTH,
      height: LEVEL_HEIGHT,
      backgroundColor: parseSkyColor(options.sceneConfig.sky),
      antialias: true,
    });
    options.container.appendChild(app.canvas);
    app.canvas.style.width = "100%";
    app.canvas.style.height = "100%";
    app.canvas.style.display = "block";

    const texture = await CollectGame.loadTexture(options.textureSource);
    const engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } });

    const game = new CollectGame(app, engine, texture, options.sceneConfig, options);
    await game.buildWorld();
    game.attachEvents();
    game.attachTicker();
    game.audio.startMusic();
    return game;
  }

  private static async loadTexture(source: HTMLCanvasElement | string): Promise<PIXI.Texture> {
    return typeof source === "string" ? await PIXI.Assets.load(source) : PIXI.Texture.from(source);
  }

  private addBody(body: Matter.Body) {
    Matter.World.add(this.engine.world, body);
    this.worldObjects.push(body);
  }

  private addWall(x: number, y: number, width: number, height: number) {
    const graphic = new PIXI.Graphics().rect(-width / 2, -height / 2, width, height).fill(0x1f2937);
    graphic.x = x;
    graphic.y = y;
    this.app.stage.addChild(graphic);
    this.worldGraphics.push(graphic);
    this.addBody(Matter.Bodies.rectangle(x, y, width, height, { isStatic: true, label: "wall" }));
  }

  private async buildWorld() {
    // Moldura sólida ao redor da arena - o jogador não sai do canvas.
    this.addWall(LEVEL_WIDTH / 2, WALL_THICKNESS / 2, LEVEL_WIDTH, WALL_THICKNESS);
    this.addWall(LEVEL_WIDTH / 2, LEVEL_HEIGHT - WALL_THICKNESS / 2, LEVEL_WIDTH, WALL_THICKNESS);
    this.addWall(WALL_THICKNESS / 2, LEVEL_HEIGHT / 2, WALL_THICKNESS, LEVEL_HEIGHT);
    this.addWall(LEVEL_WIDTH - WALL_THICKNESS / 2, LEVEL_HEIGHT / 2, WALL_THICKNESS, LEVEL_HEIGHT);

    const margin = WALL_THICKNESS + 40;
    const playerStart = { x: LEVEL_WIDTH / 2, y: LEVEL_HEIGHT / 2 };
    const taken: { x: number; y: number }[] = [playerStart];

    for (const coin of this.sceneConfig.coins) {
      const { x, y } = randomPosition(taken, margin);
      taken.push({ x, y });

      const body = Matter.Bodies.circle(x, y, COIN_RADIUS, { isStatic: true, isSensor: true, label: "coin" });
      this.addBody(body);

      let graphic: PIXI.Container;
      if (coin.imageUrl) {
        const texture = await CollectGame.loadTexture(coin.imageUrl);
        const sprite = new PIXI.Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.x = x;
        sprite.y = y;
        sprite.width = COIN_RADIUS * 2;
        sprite.height = COIN_RADIUS * 2;
        graphic = sprite;
      } else {
        graphic = new PIXI.Graphics().circle(x, y, COIN_RADIUS).fill(0xffc736);
      }
      this.app.stage.addChild(graphic);
      this.coinEntities.push({ body, graphic });
    }

    for (const obstacle of this.sceneConfig.obstacles) {
      const { x, y } = randomPosition(taken, margin);
      taken.push({ x, y });

      // "hop" não faz sentido sem pulo aqui - vira bloco sólido simples, igual
      // a um obstáculo físico qualquer.
      const isLethal = obstacle.type === "hazard" || obstacle.type === "enemy";
      const isDestructible = obstacle.type === "destructible";
      const label = isLethal ? obstacle.type : isDestructible ? "destructible" : "hop";

      const body = Matter.Bodies.rectangle(x, y, OBSTACLE_SIZE, OBSTACLE_SIZE, {
        isStatic: true,
        isSensor: isLethal,
        label,
      });
      this.addBody(body);

      const fillColor = isLethal
        ? 0xef4444
        : isDestructible
          ? 0x9a7b4f
          : obstacle.type === "dynamic"
            ? 0x8b5cf6
            : 0x9ca3af;

      let graphic: PIXI.Container;
      if (obstacle.imageUrl) {
        const texture = await CollectGame.loadTexture(obstacle.imageUrl);
        const sprite = new PIXI.Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.x = x;
        sprite.y = y;
        sprite.width = OBSTACLE_SIZE;
        sprite.height = OBSTACLE_SIZE;
        graphic = sprite;
      } else {
        graphic = new PIXI.Graphics()
          .poly([-OBSTACLE_SIZE / 2, OBSTACLE_SIZE / 2, OBSTACLE_SIZE / 2, OBSTACLE_SIZE / 2, 0, -OBSTACLE_SIZE / 2])
          .fill(fillColor);
        graphic.x = x;
        graphic.y = y;
      }
      this.app.stage.addChild(graphic);

      if (obstacle.type === "enemy") {
        this.enemyEntities.push({
          body,
          graphic,
          spawnX: x,
          spawnY: y,
          behavior: obstacle.enemyBehavior ?? "perseguidor",
          speed: obstacle.speed ?? ENEMY_DEFAULT_SPEED,
          visionRange: obstacle.visionRange ?? ENEMY_DEFAULT_VISION_RANGE,
          phase: Math.random() * 1000,
          lastShotAt: 0,
        });
      } else if (isDestructible) {
        this.destructibleEntities.push({ body, graphic });
      } else {
        this.worldGraphics.push(graphic);
      }
    }

    for (const powerup of this.sceneConfig.powerups ?? []) {
      const { x, y } = randomPosition(taken, margin);
      taken.push({ x, y });

      const body = Matter.Bodies.circle(x, y, POWERUP_RADIUS, {
        isStatic: true,
        isSensor: true,
        label: `powerup:${powerup.type}`,
      });
      this.addBody(body);

      let graphic: PIXI.Container;
      if (powerup.imageUrl) {
        const texture = await CollectGame.loadTexture(powerup.imageUrl);
        const sprite = new PIXI.Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.x = x;
        sprite.y = y;
        sprite.width = POWERUP_RADIUS * 2;
        sprite.height = POWERUP_RADIUS * 2;
        graphic = sprite;
      } else {
        graphic = new PIXI.Graphics()
          .star(x, y, 5, POWERUP_RADIUS, POWERUP_RADIUS / 2)
          .fill(POWERUP_COLORS[powerup.type]);
      }
      this.app.stage.addChild(graphic);
      this.powerupEntities.push({ body, graphic, type: powerup.type });
    }

    this.playerBody = Matter.Bodies.circle(playerStart.x, playerStart.y, PLAYER_RADIUS, {
      inertia: Infinity,
      friction: 0,
      frictionAir: 0,
      label: "player",
    });
    this.addBody(this.playerBody);

    this.shieldGraphic = new PIXI.Graphics().circle(0, 0, PLAYER_RADIUS + 8).stroke({ width: 3, color: 0x60a5fa });
    this.shieldGraphic.visible = false;
    this.app.stage.addChild(this.shieldGraphic);

    this.playerSprite = new PIXI.Sprite(this.texture);
    this.playerSprite.anchor.set(0.5);
    this.playerSprite.width = PLAYER_RADIUS * 2;
    this.playerSprite.height = PLAYER_RADIUS * 2;
    this.app.stage.addChild(this.playerSprite);
  }

  private attachEvents() {
    Matter.Events.on(this.engine, "collisionStart", (event) => {
      for (const pair of event.pairs) {
        this.handleCollision(pair.bodyA, pair.bodyB);
        this.handleCollision(pair.bodyB, pair.bodyA);
      }
    });
  }

  private handleCollision(body: Matter.Body, other: Matter.Body) {
    if (body.label !== "player" || this.isGameOver) return;

    if (other.label === "coin") {
      const entity = this.coinEntities.find((coin) => coin.body === other);
      if (!entity) return;
      Matter.World.remove(this.engine.world, other);
      entity.graphic.destroy();
      this.coinEntities = this.coinEntities.filter((coin) => coin !== entity);
      this.coins += Date.now() < this.doubleCoinsUntil ? 2 : 1;
      this.callbacks.onCoinsChange?.(this.coins);
      this.audio.playCoin();

      if (this.coinEntities.length === 0) {
        this.isGameOver = true;
        this.callbacks.onWin?.();
        this.audio.playWin();
      }
    }

    if (other.label?.startsWith("powerup:")) {
      const entity = this.powerupEntities.find((powerup) => powerup.body === other);
      if (!entity) return;
      Matter.World.remove(this.engine.world, other);
      entity.graphic.destroy();
      this.powerupEntities = this.powerupEntities.filter((powerup) => powerup !== entity);
      this.applyPowerup(entity.type);
      this.audio.playPowerup();
    }

    if (other.label === "destructible") {
      const entity = this.destructibleEntities.find((item) => item.body === other);
      if (!entity) return;
      Matter.World.remove(this.engine.world, other);
      entity.graphic.destroy();
      this.destructibleEntities = this.destructibleEntities.filter((item) => item !== entity);
      this.audio.playCoin();
    }

    if (other.label === "projectile") {
      const entity = this.projectileEntities.find((projectile) => projectile.body === other);
      if (entity) {
        Matter.World.remove(this.engine.world, entity.body);
        entity.graphic.destroy();
        this.projectileEntities = this.projectileEntities.filter((projectile) => projectile !== entity);
      }
    }

    if (
      (other.label === "hazard" || other.label === "enemy" || other.label === "projectile") &&
      Date.now() > this.invulnerableUntil
    ) {
      this.invulnerableUntil = Date.now() + INVULNERABILITY_MS;
      this.lives -= 1;
      this.callbacks.onLivesChange?.(this.lives);
      this.audio.playDamage();
      if (this.lives <= 0) {
        this.isGameOver = true;
        this.callbacks.onLose?.();
        this.audio.playLose();
      }
    }
  }

  private spawnProjectile(x: number, y: number, direction: { x: number; y: number }) {
    const body = Matter.Bodies.circle(x, y, PROJECTILE_SIZE / 2, {
      isStatic: true,
      isSensor: true,
      label: "projectile",
    });
    this.addBody(body);
    const graphic = new PIXI.Graphics().circle(0, 0, PROJECTILE_SIZE / 2).fill(0xef4444);
    graphic.x = x;
    graphic.y = y;
    this.app.stage.addChild(graphic);
    this.projectileEntities.push({
      body,
      graphic,
      spawnAt: Date.now(),
      vx: direction.x * PROJECTILE_SPEED,
      vy: direction.y * PROJECTILE_SPEED,
    });
  }

  private applyPowerup(type: PowerupType) {
    if (type === "extra_life") {
      this.lives += 1;
      this.callbacks.onLivesChange?.(this.lives);
    } else if (type === "shield") {
      this.invulnerableUntil = Math.max(this.invulnerableUntil, Date.now() + SHIELD_DURATION_MS);
    } else if (type === "double_coins") {
      this.doubleCoinsUntil = Date.now() + DOUBLE_COINS_DURATION_MS;
    }
  }

  private attachTicker() {
    this.app.ticker.add((ticker) => {
      if (this.isGameOver) return;

      this.elapsedMs += ticker.deltaMS;

      const secondsRemaining = Math.max(0, TIME_LIMIT_SECONDS - Math.floor(this.elapsedMs / 1000));
      if (secondsRemaining !== this.lastReportedSecond) {
        this.lastReportedSecond = secondsRemaining;
        this.callbacks.onTimeChange?.(secondsRemaining);
      }
      if (secondsRemaining <= 0) {
        this.isGameOver = true;
        this.callbacks.onLose?.();
        this.audio.playLose();
        return;
      }

      const velocity = { x: 0, y: 0 };
      if (this.direction === "left") velocity.x = -MOVE_SPEED;
      if (this.direction === "right") velocity.x = MOVE_SPEED;
      if (this.direction === "up") velocity.y = -MOVE_SPEED;
      if (this.direction === "down") velocity.y = MOVE_SPEED;
      Matter.Body.setVelocity(this.playerBody, velocity);

      // Cada inimigo se move conforme seu enemyBehavior (ver enemy-ai.ts).
      // A arena é aberta em 2D (sem chão fixo) - aqui "voador" não se
      // distingue de "perseguidor" (ambos perseguem livremente nos dois
      // eixos); "saltador" ganha um solavanco vertical sobre a patrulha.
      const playerPos = { x: this.playerBody.position.x, y: this.playerBody.position.y };
      for (const enemy of this.enemyEntities) {
        let x: number;
        let y: number;

        if (enemy.behavior === "saltador") {
          x = enemy.spawnX + patrolOffset(this.elapsedMs, enemy.phase);
          y = enemy.spawnY + jumpOffset(this.elapsedMs, enemy.phase);
        } else {
          const stepPerTick = enemy.speed * (ticker.deltaMS / 16.67);
          const target = computeEnemyTarget(
            enemy.behavior,
            { x: enemy.spawnX, y: enemy.spawnY },
            { x: enemy.body.position.x, y: enemy.body.position.y },
            playerPos,
            this.elapsedMs,
            stepPerTick,
            enemy.visionRange,
            enemy.phase,
            true,
          );
          x = target.x;
          y = target.y;
        }

        Matter.Body.setPosition(enemy.body, { x, y });
        enemy.graphic.x = x;
        enemy.graphic.y = y;

        if (
          enemy.behavior === "atirador" &&
          shouldShoot(enemy.lastShotAt, Date.now(), ENEMY_SHOOT_INTERVAL_MS, { x, y }, playerPos, enemy.visionRange)
        ) {
          enemy.lastShotAt = Date.now();
          this.spawnProjectile(x, y, aimDirection({ x, y }, playerPos));
        }
      }

      for (const projectile of this.projectileEntities) {
        const x = projectile.body.position.x + projectile.vx;
        const y = projectile.body.position.y + projectile.vy;
        Matter.Body.setPosition(projectile.body, { x, y });
        projectile.graphic.x = x;
        projectile.graphic.y = y;
      }
      this.projectileEntities = this.projectileEntities.filter((projectile) => {
        const expired = Date.now() - projectile.spawnAt > PROJECTILE_LIFETIME_MS;
        const outOfBounds =
          projectile.body.position.x < -20 ||
          projectile.body.position.x > LEVEL_WIDTH + 20 ||
          projectile.body.position.y < -20 ||
          projectile.body.position.y > LEVEL_HEIGHT + 20;
        if (expired || outOfBounds) {
          Matter.World.remove(this.engine.world, projectile.body);
          projectile.graphic.destroy();
          return false;
        }
        return true;
      });

      Matter.Engine.update(this.engine, ticker.deltaMS);

      this.playerSprite.x = this.playerBody.position.x;
      this.playerSprite.y = this.playerBody.position.y;

      this.shieldGraphic.x = this.playerBody.position.x;
      this.shieldGraphic.y = this.playerBody.position.y;
      this.shieldGraphic.visible = Date.now() < this.invulnerableUntil;
    });
  }

  moveLeft() {
    this.direction = "left";
  }

  moveRight() {
    this.direction = "right";
  }

  moveUp() {
    this.direction = "up";
  }

  moveDown() {
    this.direction = "down";
  }

  stopMove() {
    this.direction = null;
  }

  jump() {
    // Coleta de Itens é em campo aberto, sem pulo.
  }

  toggleMute() {
    this.audio.setMuted(!this.audio.isMuted());
    return this.audio.isMuted();
  }

  isMuted() {
    return this.audio.isMuted();
  }

  getElapsedSeconds() {
    return Math.round(this.elapsedMs / 1000);
  }

  getCoins() {
    return this.coins;
  }

  getLives() {
    return this.lives;
  }

  async reset() {
    for (const body of this.worldObjects) {
      Matter.World.remove(this.engine.world, body);
    }
    for (const graphic of this.worldGraphics) {
      graphic.destroy();
    }
    for (const coin of this.coinEntities) {
      Matter.World.remove(this.engine.world, coin.body);
      coin.graphic.destroy();
    }
    for (const powerup of this.powerupEntities) {
      Matter.World.remove(this.engine.world, powerup.body);
      powerup.graphic.destroy();
    }
    for (const destructible of this.destructibleEntities) {
      Matter.World.remove(this.engine.world, destructible.body);
      destructible.graphic.destroy();
    }
    for (const enemy of this.enemyEntities) {
      Matter.World.remove(this.engine.world, enemy.body);
      enemy.graphic.destroy();
    }
    for (const projectile of this.projectileEntities) {
      Matter.World.remove(this.engine.world, projectile.body);
      projectile.graphic.destroy();
    }
    this.playerSprite.destroy();
    this.shieldGraphic.destroy();

    this.worldObjects = [];
    this.worldGraphics = [];
    this.coinEntities = [];
    this.powerupEntities = [];
    this.destructibleEntities = [];
    this.enemyEntities = [];
    this.projectileEntities = [];
    this.direction = null;
    this.invulnerableUntil = 0;
    this.doubleCoinsUntil = 0;
    this.isGameOver = false;
    this.lives = START_LIVES;
    this.coins = 0;
    this.elapsedMs = 0;
    this.lastReportedSecond = -1;

    await this.buildWorld();
    this.callbacks.onCoinsChange?.(this.coins);
    this.callbacks.onLivesChange?.(this.lives);
    this.callbacks.onTimeChange?.(TIME_LIMIT_SECONDS);
  }

  requestFullscreen() {
    const element = this.app.canvas.parentElement ?? this.app.canvas;
    void element.requestFullscreen?.();
  }

  destroy() {
    Matter.Events.off(this.engine, "collisionStart", undefined as never);
    Matter.Engine.clear(this.engine);
    this.audio.destroy();
    this.app.destroy(true, { children: true });
  }
}
