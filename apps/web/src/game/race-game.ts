import Matter from "matter-js";
import * as PIXI from "pixi.js";

import { GameAudio } from "@/game/audio";
import type { GameEngine, GameEngineCallbacks, GameEngineOptions } from "@/game/game-engine";
import { LEVEL_HEIGHT, LEVEL_WIDTH } from "@/game/level-constants";
import type { PowerupType, SceneConfig } from "@/lib/scene-config-builder";

const GROUND_THICKNESS = 60;
const GROUND_Y = 460;
const PLAYER_SIZE = 44;
const PLAYER_X = 150;
const JUMP_VELOCITY = -14;
const OBSTACLE_SIZE = 36;
const COIN_RADIUS = 14;
const POWERUP_RADIUS = 16;
const BASE_SPEED = 4.5;
const MAX_SPEED = 9;
const SPEED_RAMP_MS = 40000;
const WIN_TIME_SECONDS = 45;
const START_LIVES = 3;
const INVULNERABILITY_MS = 1000;
const SHIELD_DURATION_MS = 5000;
const DOUBLE_COINS_DURATION_MS = 8000;
const BASE_SPAWN_INTERVAL_MS = 1100;
const DEFAULT_SKY_COLOR = 0x0ea5e9;

const POWERUP_COLORS: Record<PowerupType, number> = {
  extra_life: 0xef4444,
  shield: 0x60a5fa,
  double_coins: 0xffc736,
};

type SpawnKind = "obstacle" | "coin" | "powerup";
type SpawnItem = { kind: SpawnKind; imageUrl?: string; powerup?: PowerupType };
type MovingEntity = { body: Matter.Body; graphic: PIXI.Container };
type PowerupEntity = MovingEntity & { type: PowerupType };

function parseSkyColor(sky?: string): number {
  if (!sky) return DEFAULT_SKY_COLOR;
  const parsed = Number.parseInt(sky.replace("#", ""), 16);
  return Number.isNaN(parsed) ? DEFAULT_SKY_COLOR : parsed;
}

/**
 * Corredor infinito: o personagem fica numa posição X fixa (só pula), e é o
 * cenário (obstáculos/moedas/powerups) que se move da direita pra esquerda,
 * cada vez mais rápido - evita ter que implementar rolagem de câmera de
 * verdade, que nenhum motor hoje tem.
 */
export class RaceGame implements GameEngine {
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
  private groundContacts = 0;

  private obstacleEntities: MovingEntity[] = [];
  private coinEntities: MovingEntity[] = [];
  private powerupEntities: PowerupEntity[] = [];

  private spawnQueue: SpawnItem[] = [];
  private spawnIndex = 0;
  private nextSpawnAt = 0;

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

  static async create(options: GameEngineOptions): Promise<RaceGame> {
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

    const texture = await RaceGame.loadTexture(options.textureSource);
    const engine = Matter.Engine.create({ gravity: { x: 0, y: 1 } });

    const game = new RaceGame(app, engine, texture, options.sceneConfig, options);
    game.buildSpawnQueue();
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

  /** Fila de itens a serem lançados repetidamente - vinda do que a criança marcou no desenho. */
  private buildSpawnQueue() {
    const items: SpawnItem[] = [
      ...this.sceneConfig.obstacles.map((obstacle) => ({ kind: "obstacle" as const, imageUrl: obstacle.imageUrl })),
      ...this.sceneConfig.coins.map((coin) => ({ kind: "coin" as const, imageUrl: coin.imageUrl })),
      ...(this.sceneConfig.powerups ?? []).map((powerup) => ({
        kind: "powerup" as const,
        imageUrl: powerup.imageUrl,
        powerup: powerup.type,
      })),
    ];
    // Nada marcado no desenho (raro, mas possível) - garante que o corredor
    // continue jogável com obstáculos genéricos em vez de ficar vazio.
    this.spawnQueue = items.length > 0 ? items : [{ kind: "obstacle" }];
  }

  private currentSpeed(): number {
    const progress = Math.min(1, this.elapsedMs / SPEED_RAMP_MS);
    return BASE_SPEED + (MAX_SPEED - BASE_SPEED) * progress;
  }

  private async buildWorld() {
    const ground = Matter.Bodies.rectangle(
      LEVEL_WIDTH / 2,
      GROUND_Y + GROUND_THICKNESS / 2,
      LEVEL_WIDTH + 200,
      GROUND_THICKNESS,
      { isStatic: true, label: "ground" },
    );
    this.addBody(ground);
    const groundGraphic = new PIXI.Graphics()
      .rect(0, GROUND_Y, LEVEL_WIDTH, GROUND_THICKNESS)
      .fill(0x1e293b)
      .rect(0, GROUND_Y, LEVEL_WIDTH, 8)
      .fill(0x475569);
    this.app.stage.addChild(groundGraphic);
    this.worldGraphics.push(groundGraphic);

    this.playerBody = Matter.Bodies.rectangle(PLAYER_X, GROUND_Y - PLAYER_SIZE / 2 - 2, PLAYER_SIZE, PLAYER_SIZE, {
      inertia: Infinity,
      friction: 0,
      label: "player",
    });
    this.addBody(this.playerBody);

    this.shieldGraphic = new PIXI.Graphics()
      .circle(0, 0, PLAYER_SIZE / 2 + 8)
      .stroke({ width: 3, color: 0x60a5fa });
    this.shieldGraphic.visible = false;
    this.app.stage.addChild(this.shieldGraphic);

    this.playerSprite = new PIXI.Sprite(this.texture);
    this.playerSprite.anchor.set(0.5);
    this.playerSprite.width = PLAYER_SIZE;
    this.playerSprite.height = PLAYER_SIZE;
    this.app.stage.addChild(this.playerSprite);

    this.nextSpawnAt = 400;
  }

  private async spawnNext() {
    const item = this.spawnQueue[this.spawnIndex % this.spawnQueue.length];
    this.spawnIndex += 1;
    const x = LEVEL_WIDTH + OBSTACLE_SIZE;

    if (item.kind === "coin") {
      const y = GROUND_Y - PLAYER_SIZE / 2 - 2;
      const body = Matter.Bodies.circle(x, y, COIN_RADIUS, { isStatic: true, isSensor: true, label: "coin" });
      this.addBody(body);
      const graphic = await this.buildCircleGraphic(item.imageUrl, COIN_RADIUS, 0xffc736);
      graphic.x = x;
      graphic.y = y;
      this.app.stage.addChild(graphic);
      this.coinEntities.push({ body, graphic });
      return;
    }

    if (item.kind === "powerup" && item.powerup) {
      const y = GROUND_Y - PLAYER_SIZE / 2 - 2;
      const body = Matter.Bodies.circle(x, y, POWERUP_RADIUS, {
        isStatic: true,
        isSensor: true,
        label: `powerup:${item.powerup}`,
      });
      this.addBody(body);
      const graphic = await this.buildCircleGraphic(item.imageUrl, POWERUP_RADIUS, POWERUP_COLORS[item.powerup], true);
      graphic.x = x;
      graphic.y = y;
      this.app.stage.addChild(graphic);
      this.powerupEntities.push({ body, graphic, type: item.powerup });
      return;
    }

    const y = GROUND_Y - OBSTACLE_SIZE / 2;
    const body = Matter.Bodies.rectangle(x, y, OBSTACLE_SIZE, OBSTACLE_SIZE, {
      isStatic: true,
      isSensor: true,
      label: "hazard",
    });
    this.addBody(body);
    let graphic: PIXI.Container;
    if (item.imageUrl) {
      const texture = await RaceGame.loadTexture(item.imageUrl);
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.width = OBSTACLE_SIZE;
      sprite.height = OBSTACLE_SIZE;
      graphic = sprite;
    } else {
      graphic = new PIXI.Graphics()
        .poly([-OBSTACLE_SIZE / 2, OBSTACLE_SIZE / 2, OBSTACLE_SIZE / 2, OBSTACLE_SIZE / 2, 0, -OBSTACLE_SIZE / 2])
        .fill(0xef4444);
    }
    graphic.x = x;
    graphic.y = y;
    this.app.stage.addChild(graphic);
    this.obstacleEntities.push({ body, graphic });
  }

  private async buildCircleGraphic(
    imageUrl: string | undefined,
    radius: number,
    color: number,
    star = false,
  ): Promise<PIXI.Container> {
    if (imageUrl) {
      const texture = await RaceGame.loadTexture(imageUrl);
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.width = radius * 2;
      sprite.height = radius * 2;
      return sprite;
    }
    return star
      ? new PIXI.Graphics().star(0, 0, 5, radius, radius / 2).fill(color)
      : new PIXI.Graphics().circle(0, 0, radius).fill(color);
  }

  private attachEvents() {
    Matter.Events.on(this.engine, "collisionStart", (event) => {
      for (const pair of event.pairs) {
        this.handleCollision(pair.bodyA, pair.bodyB);
        this.handleCollision(pair.bodyB, pair.bodyA);

        if (this.isGroundPair(pair.bodyA, pair.bodyB)) this.groundContacts += 1;
      }
    });

    Matter.Events.on(this.engine, "collisionEnd", (event) => {
      for (const pair of event.pairs) {
        if (this.isGroundPair(pair.bodyA, pair.bodyB)) {
          this.groundContacts = Math.max(0, this.groundContacts - 1);
        }
      }
    });
  }

  private isGroundPair(a: Matter.Body, b: Matter.Body) {
    return (a.label === "player" && b.label === "ground") || (b.label === "player" && a.label === "ground");
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

    if (other.label === "hazard" && Date.now() > this.invulnerableUntil) {
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

      const secondsRemaining = Math.max(0, WIN_TIME_SECONDS - Math.floor(this.elapsedMs / 1000));
      if (secondsRemaining !== this.lastReportedSecond) {
        this.lastReportedSecond = secondsRemaining;
        this.callbacks.onTimeChange?.(secondsRemaining);
      }
      if (secondsRemaining <= 0) {
        this.isGameOver = true;
        this.callbacks.onWin?.();
        this.audio.playWin();
        return;
      }

      if (this.elapsedMs >= this.nextSpawnAt) {
        void this.spawnNext();
        this.nextSpawnAt = this.elapsedMs + BASE_SPAWN_INTERVAL_MS * (BASE_SPEED / this.currentSpeed());
      }

      const step = this.currentSpeed() * (ticker.deltaMS / 16.67);
      const shiftLeft = (entity: MovingEntity) => {
        const x = entity.body.position.x - step;
        Matter.Body.setPosition(entity.body, { x, y: entity.body.position.y });
        entity.graphic.x = x;
      };
      this.obstacleEntities.forEach(shiftLeft);
      this.coinEntities.forEach(shiftLeft);
      this.powerupEntities.forEach(shiftLeft);

      const offScreen = (entity: MovingEntity) => entity.body.position.x < -OBSTACLE_SIZE;
      for (const entity of this.obstacleEntities.filter(offScreen)) {
        Matter.World.remove(this.engine.world, entity.body);
        entity.graphic.destroy();
      }
      this.obstacleEntities = this.obstacleEntities.filter((entity) => !offScreen(entity));
      for (const entity of this.coinEntities.filter(offScreen)) {
        Matter.World.remove(this.engine.world, entity.body);
        entity.graphic.destroy();
      }
      this.coinEntities = this.coinEntities.filter((entity) => !offScreen(entity));
      for (const entity of this.powerupEntities.filter(offScreen)) {
        Matter.World.remove(this.engine.world, entity.body);
        entity.graphic.destroy();
      }
      this.powerupEntities = this.powerupEntities.filter((entity) => !offScreen(entity));

      Matter.Engine.update(this.engine, ticker.deltaMS);

      this.playerSprite.x = this.playerBody.position.x;
      this.playerSprite.y = this.playerBody.position.y;

      this.shieldGraphic.x = this.playerBody.position.x;
      this.shieldGraphic.y = this.playerBody.position.y;
      this.shieldGraphic.visible = Date.now() < this.invulnerableUntil;
    });
  }

  moveLeft() {
    // Corrida não tem controle horizontal - o cenário que se move.
  }

  moveRight() {
    // Corrida não tem controle horizontal - o cenário que se move.
  }

  moveUp() {
    // Sem movimento vertical livre - pular é feito por jump().
  }

  moveDown() {
    // Sem movimento vertical livre - pular é feito por jump().
  }

  stopMove() {
    // Sem direção contínua neste template.
  }

  jump() {
    if (this.groundContacts > 0 && !this.isGameOver) {
      Matter.Body.setVelocity(this.playerBody, { x: 0, y: JUMP_VELOCITY });
      this.audio.playJump();
    }
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
    for (const entity of [...this.obstacleEntities, ...this.coinEntities, ...this.powerupEntities]) {
      Matter.World.remove(this.engine.world, entity.body);
      entity.graphic.destroy();
    }
    this.playerSprite.destroy();
    this.shieldGraphic.destroy();

    this.worldObjects = [];
    this.worldGraphics = [];
    this.obstacleEntities = [];
    this.coinEntities = [];
    this.powerupEntities = [];
    this.spawnIndex = 0;
    this.groundContacts = 0;
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
    this.callbacks.onTimeChange?.(WIN_TIME_SECONDS);
  }

  requestFullscreen() {
    const element = this.app.canvas.parentElement ?? this.app.canvas;
    void element.requestFullscreen?.();
  }

  destroy() {
    Matter.Events.off(this.engine, "collisionStart", undefined as never);
    Matter.Events.off(this.engine, "collisionEnd", undefined as never);
    Matter.Engine.clear(this.engine);
    this.audio.destroy();
    this.app.destroy(true, { children: true });
  }
}
