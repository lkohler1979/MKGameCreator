import Matter from "matter-js";
import * as PIXI from "pixi.js";

import { GameAudio } from "@/game/audio";
import type { GameEngine, GameEngineCallbacks, GameEngineOptions } from "@/game/game-engine";
import { LEVEL_HEIGHT, LEVEL_WIDTH } from "@/game/level-constants";
import type { PowerupType, SceneConfig } from "@/lib/scene-config-builder";

const WALL_THICKNESS = 12;
const GOAL_WIDTH = 160;
const GOAL_SENSOR_HEIGHT = 50;
const PLAYER_RADIUS = 20;
const PUCK_RADIUS = 14;
const MOVE_SPEED = 4.5;
const PUCK_LAUNCH_SPEED = 5;
const PUCK_MAX_SPEED = 9;
// Piso de velocidade: o solver do Matter.js perde energia gradualmente em
// quiques repetidos (mais perceptível quando o disco fica preso batendo num
// canto) mesmo com restitution:1/friction:0 em todos os corpos - sem isso o
// disco literalmente para. Prática comum em jogos de air hockey/pong.
const PUCK_MIN_SPEED = 3;
const BUMPER_SIZE = 32;
const COIN_RADIUS = 14;
const POWERUP_RADIUS = 16;
const WIN_SCORE = 5;
const START_LIVES = 3;
const SHIELD_DURATION_MS = 5000;
const DOUBLE_COINS_DURATION_MS = 8000;
const MIN_SPAWN_DISTANCE = 60;
const DEFAULT_SKY_COLOR = 0x134e4a;

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
  return {
    x: margin + Math.random() * (LEVEL_WIDTH - margin * 2),
    y: margin + Math.random() * (LEVEL_HEIGHT - margin * 2),
  };
}

/**
 * Air Hockey solo: sem oponente, é um desafio de precisão - rebater o disco
 * pro gol de cima marca ponto, deixar entrar no gol de baixo (o "seu") custa
 * uma vida. Obstáculos do desenho viram rebatedores fixos na arena.
 */
export class AirHockeyGame implements GameEngine {
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
  private puckBody!: Matter.Body;
  private puckGraphic!: PIXI.Graphics;

  private coinEntities: { body: Matter.Body; graphic: PIXI.Container }[] = [];
  private powerupEntities: { body: Matter.Body; graphic: PIXI.Container; type: PowerupType }[] = [];
  private bumperEntities: { body: Matter.Body; graphic: PIXI.Container }[] = [];

  private direction: Direction = null;
  private shieldUntil = 0;
  private doubleCoinsUntil = 0;
  private isGameOver = false;
  private lives = START_LIVES;
  private goals = 0;
  private coins = 0;
  private elapsedMs = 0;

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

  static async create(options: GameEngineOptions): Promise<AirHockeyGame> {
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

    const texture = await AirHockeyGame.loadTexture(options.textureSource);
    const engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } });

    const game = new AirHockeyGame(app, engine, texture, options.sceneConfig, options);
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

  private addWallSegment(x: number, y: number, width: number, height: number) {
    const graphic = new PIXI.Graphics().rect(-width / 2, -height / 2, width, height).fill(0x1f2937);
    graphic.x = x;
    graphic.y = y;
    this.app.stage.addChild(graphic);
    this.worldGraphics.push(graphic);
    this.addBody(
      Matter.Bodies.rectangle(x, y, width, height, {
        isStatic: true,
        restitution: 1,
        friction: 0,
        frictionStatic: 0,
        label: "wall",
      }),
    );
  }

  private async buildWorld() {
    // Paredes esquerda/direita inteiras; em cima/embaixo, dois segmentos
    // deixando um vão no meio (o gol) - o sensor de gol fica bem no vão.
    this.addWallSegment(WALL_THICKNESS / 2, LEVEL_HEIGHT / 2, WALL_THICKNESS, LEVEL_HEIGHT);
    this.addWallSegment(LEVEL_WIDTH - WALL_THICKNESS / 2, LEVEL_HEIGHT / 2, WALL_THICKNESS, LEVEL_HEIGHT);

    const sideWidth = (LEVEL_WIDTH - GOAL_WIDTH) / 2;
    this.addWallSegment(sideWidth / 2, WALL_THICKNESS / 2, sideWidth, WALL_THICKNESS);
    this.addWallSegment(LEVEL_WIDTH - sideWidth / 2, WALL_THICKNESS / 2, sideWidth, WALL_THICKNESS);
    this.addWallSegment(sideWidth / 2, LEVEL_HEIGHT - WALL_THICKNESS / 2, sideWidth, WALL_THICKNESS);
    this.addWallSegment(LEVEL_WIDTH - sideWidth / 2, LEVEL_HEIGHT - WALL_THICKNESS / 2, sideWidth, WALL_THICKNESS);

    const topGoalGraphic = new PIXI.Graphics()
      .rect(-GOAL_WIDTH / 2, -WALL_THICKNESS / 2, GOAL_WIDTH, WALL_THICKNESS)
      .fill(0xffc736);
    topGoalGraphic.x = LEVEL_WIDTH / 2;
    topGoalGraphic.y = WALL_THICKNESS / 2;
    this.app.stage.addChild(topGoalGraphic);
    this.worldGraphics.push(topGoalGraphic);
    this.addBody(
      Matter.Bodies.rectangle(LEVEL_WIDTH / 2, WALL_THICKNESS / 2, GOAL_WIDTH, GOAL_SENSOR_HEIGHT, {
        isStatic: true,
        isSensor: true,
        label: "goal:top",
      }),
    );

    const bottomGoalGraphic = new PIXI.Graphics()
      .rect(-GOAL_WIDTH / 2, -WALL_THICKNESS / 2, GOAL_WIDTH, WALL_THICKNESS)
      .fill(0xef4444);
    bottomGoalGraphic.x = LEVEL_WIDTH / 2;
    bottomGoalGraphic.y = LEVEL_HEIGHT - WALL_THICKNESS / 2;
    this.app.stage.addChild(bottomGoalGraphic);
    this.worldGraphics.push(bottomGoalGraphic);
    this.addBody(
      Matter.Bodies.rectangle(LEVEL_WIDTH / 2, LEVEL_HEIGHT - WALL_THICKNESS / 2, GOAL_WIDTH, GOAL_SENSOR_HEIGHT, {
        isStatic: true,
        isSensor: true,
        label: "goal:bottom",
      }),
    );

    const margin = WALL_THICKNESS + 50;
    const playerStart = { x: LEVEL_WIDTH / 2, y: LEVEL_HEIGHT - 90 };
    const taken: { x: number; y: number }[] = [playerStart, { x: LEVEL_WIDTH / 2, y: LEVEL_HEIGHT / 2 }];

    for (const obstacle of this.sceneConfig.obstacles) {
      const { x, y } = randomPosition(taken, margin);
      taken.push({ x, y });

      const body = Matter.Bodies.rectangle(x, y, BUMPER_SIZE, BUMPER_SIZE, {
        isStatic: true,
        restitution: 1,
        friction: 0,
        frictionStatic: 0,
        label: "bumper",
      });
      this.addBody(body);

      let graphic: PIXI.Container;
      if (obstacle.imageUrl) {
        const texture = await AirHockeyGame.loadTexture(obstacle.imageUrl);
        const sprite = new PIXI.Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.width = BUMPER_SIZE;
        sprite.height = BUMPER_SIZE;
        graphic = sprite;
      } else {
        graphic = new PIXI.Graphics().circle(0, 0, BUMPER_SIZE / 2).fill(0x8b5cf6);
      }
      graphic.x = x;
      graphic.y = y;
      this.app.stage.addChild(graphic);
      this.bumperEntities.push({ body, graphic });
    }

    for (const coin of this.sceneConfig.coins) {
      const { x, y } = randomPosition(taken, margin);
      taken.push({ x, y });

      const body = Matter.Bodies.circle(x, y, COIN_RADIUS, { isStatic: true, isSensor: true, label: "coin" });
      this.addBody(body);

      let graphic: PIXI.Container;
      if (coin.imageUrl) {
        const texture = await AirHockeyGame.loadTexture(coin.imageUrl);
        const sprite = new PIXI.Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.width = COIN_RADIUS * 2;
        sprite.height = COIN_RADIUS * 2;
        graphic = sprite;
      } else {
        graphic = new PIXI.Graphics().circle(0, 0, COIN_RADIUS).fill(0xffc736);
      }
      graphic.x = x;
      graphic.y = y;
      this.app.stage.addChild(graphic);
      this.coinEntities.push({ body, graphic });
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
        const texture = await AirHockeyGame.loadTexture(powerup.imageUrl);
        const sprite = new PIXI.Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.width = POWERUP_RADIUS * 2;
        sprite.height = POWERUP_RADIUS * 2;
        graphic = sprite;
      } else {
        graphic = new PIXI.Graphics().star(0, 0, 5, POWERUP_RADIUS, POWERUP_RADIUS / 2).fill(POWERUP_COLORS[powerup.type]);
      }
      graphic.x = x;
      graphic.y = y;
      this.app.stage.addChild(graphic);
      this.powerupEntities.push({ body, graphic, type: powerup.type });
    }

    this.playerBody = Matter.Bodies.circle(playerStart.x, playerStart.y, PLAYER_RADIUS, {
      inertia: Infinity,
      friction: 0,
      frictionStatic: 0,
      frictionAir: 0,
      restitution: 1,
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

    this.puckGraphic = new PIXI.Graphics().circle(0, 0, PUCK_RADIUS).fill(0xf8fafc);
    this.app.stage.addChild(this.puckGraphic);
    this.puckBody = Matter.Bodies.circle(LEVEL_WIDTH / 2, LEVEL_HEIGHT / 2, PUCK_RADIUS, {
      restitution: 1,
      friction: 0,
      frictionStatic: 0,
      frictionAir: 0,
      label: "puck",
    });
    this.addBody(this.puckBody);
    this.launchPuck();
  }

  private launchPuck() {
    Matter.Body.setPosition(this.puckBody, { x: LEVEL_WIDTH / 2, y: LEVEL_HEIGHT / 2 });
    const angle = (Math.random() - 0.5) * (Math.PI / 3) - Math.PI / 2;
    Matter.Body.setVelocity(this.puckBody, {
      x: Math.cos(angle) * PUCK_LAUNCH_SPEED,
      y: Math.sin(angle) * PUCK_LAUNCH_SPEED,
    });
  }

  private attachEvents() {
    Matter.Events.on(this.engine, "collisionStart", (event) => {
      for (const pair of event.pairs) {
        this.handlePlayerCollision(pair.bodyA, pair.bodyB);
        this.handlePlayerCollision(pair.bodyB, pair.bodyA);
        this.handlePuckCollision(pair.bodyA, pair.bodyB);
        this.handlePuckCollision(pair.bodyB, pair.bodyA);
      }
    });
  }

  private handlePlayerCollision(body: Matter.Body, other: Matter.Body) {
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
  }

  private handlePuckCollision(body: Matter.Body, other: Matter.Body) {
    if (body.label !== "puck" || this.isGameOver) return;

    if (other.label === "wall" || other.label === "bumper" || other.label === "player") {
      this.audio.playBounce();
    }

    if (other.label === "goal:top") {
      this.goals += 1;
      this.coins += 3;
      this.callbacks.onCoinsChange?.(this.coins);
      this.audio.playCoin();
      if (this.goals >= WIN_SCORE) {
        this.isGameOver = true;
        this.callbacks.onWin?.();
        this.audio.playWin();
        return;
      }
      this.launchPuck();
    }

    if (other.label === "goal:bottom") {
      if (Date.now() >= this.shieldUntil) {
        this.lives -= 1;
        this.callbacks.onLivesChange?.(this.lives);
        this.audio.playDamage();
        if (this.lives <= 0) {
          this.isGameOver = true;
          this.callbacks.onLose?.();
          this.audio.playLose();
          return;
        }
      }
      this.launchPuck();
    }
  }

  private applyPowerup(type: PowerupType) {
    if (type === "extra_life") {
      this.lives += 1;
      this.callbacks.onLivesChange?.(this.lives);
    } else if (type === "shield") {
      this.shieldUntil = Math.max(this.shieldUntil, Date.now() + SHIELD_DURATION_MS);
    } else if (type === "double_coins") {
      this.doubleCoinsUntil = Date.now() + DOUBLE_COINS_DURATION_MS;
    }
  }

  private attachTicker() {
    this.app.ticker.add((ticker) => {
      if (this.isGameOver) return;

      this.elapsedMs += ticker.deltaMS;

      const velocity = { x: 0, y: 0 };
      if (this.direction === "left") velocity.x = -MOVE_SPEED;
      if (this.direction === "right") velocity.x = MOVE_SPEED;
      if (this.direction === "up") velocity.y = -MOVE_SPEED;
      if (this.direction === "down") velocity.y = MOVE_SPEED;
      Matter.Body.setVelocity(this.playerBody, velocity);

      const puckSpeed = Math.hypot(this.puckBody.velocity.x, this.puckBody.velocity.y);
      if (puckSpeed > PUCK_MAX_SPEED) {
        const scale = PUCK_MAX_SPEED / puckSpeed;
        Matter.Body.setVelocity(this.puckBody, {
          x: this.puckBody.velocity.x * scale,
          y: this.puckBody.velocity.y * scale,
        });
      } else if (puckSpeed < PUCK_MIN_SPEED) {
        if (puckSpeed < 0.01) {
          this.launchPuck();
        } else {
          const scale = PUCK_MIN_SPEED / puckSpeed;
          Matter.Body.setVelocity(this.puckBody, {
            x: this.puckBody.velocity.x * scale,
            y: this.puckBody.velocity.y * scale,
          });
        }
      }

      Matter.Engine.update(this.engine, ticker.deltaMS);

      this.playerSprite.x = this.playerBody.position.x;
      this.playerSprite.y = this.playerBody.position.y;
      this.shieldGraphic.x = this.playerBody.position.x;
      this.shieldGraphic.y = this.playerBody.position.y;
      this.shieldGraphic.visible = Date.now() < this.shieldUntil;

      this.puckGraphic.x = this.puckBody.position.x;
      this.puckGraphic.y = this.puckBody.position.y;
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
    // Air Hockey não tem pulo.
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
    for (const entity of [...this.coinEntities, ...this.powerupEntities, ...this.bumperEntities]) {
      Matter.World.remove(this.engine.world, entity.body);
      entity.graphic.destroy();
    }
    this.playerSprite.destroy();
    this.shieldGraphic.destroy();
    this.puckGraphic.destroy();

    this.worldObjects = [];
    this.worldGraphics = [];
    this.coinEntities = [];
    this.powerupEntities = [];
    this.bumperEntities = [];
    this.direction = null;
    this.shieldUntil = 0;
    this.doubleCoinsUntil = 0;
    this.isGameOver = false;
    this.lives = START_LIVES;
    this.goals = 0;
    this.coins = 0;
    this.elapsedMs = 0;

    await this.buildWorld();
    this.callbacks.onCoinsChange?.(this.coins);
    this.callbacks.onLivesChange?.(this.lives);
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
