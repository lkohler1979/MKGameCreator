import Matter from "matter-js";
import * as PIXI from "pixi.js";

import { GameAudio } from "@/game/audio";
import type { GameEngine, GameEngineCallbacks, GameEngineOptions } from "@/game/game-engine";
import { LEVEL_HEIGHT, LEVEL_WIDTH } from "@/game/level-constants";
import type { PowerupType, SceneConfig } from "@/lib/scene-config-builder";

const WALL_THICKNESS = 12;
const PADDLE_WIDTH = 110;
const PADDLE_HEIGHT = 16;
const PADDLE_Y = LEVEL_HEIGHT - 36;
const PADDLE_SPEED = 7;
const BALL_RADIUS = 9;
const BALL_SPEED = 6;
const BRICK_WIDTH = 70;
const BRICK_HEIGHT = 26;
const BRICK_GAP = 6;
const GRID_TOP = WALL_THICKNESS + 44;
const MAX_ROWS = 8;
const MIN_BRICKS = 12;
const START_LIVES = 3;
const SHIELD_DURATION_MS = 5000;
const DOUBLE_COINS_DURATION_MS = 8000;
const DEFAULT_SKY_COLOR = 0x1e1b4b;

const BRICK_COLORS = [0xef4444, 0xf59e0b, 0x22c55e, 0x60a5fa, 0x8b5cf6];
const POWERUP_COLORS: Record<PowerupType, number> = {
  extra_life: 0xef4444,
  shield: 0x60a5fa,
  double_coins: 0xffc736,
};

type BrickEntity = {
  body: Matter.Body;
  graphic: PIXI.Container;
  powerup?: PowerupType;
};

function parseSkyColor(sky?: string): number {
  if (!sky) return DEFAULT_SKY_COLOR;
  const parsed = Number.parseInt(sky.replace("#", ""), 16);
  return Number.isNaN(parsed) ? DEFAULT_SKY_COLOR : parsed;
}

export class BrickBreakerGame implements GameEngine {
  private app: PIXI.Application;
  private engine: Matter.Engine;
  private sceneConfig: SceneConfig;
  private callbacks: GameEngineCallbacks;
  private texture: PIXI.Texture;
  private audio = new GameAudio();

  private worldObjects: Matter.Body[] = [];
  private worldGraphics: PIXI.Container[] = [];

  private paddleBody!: Matter.Body;
  private paddleGraphic!: PIXI.Sprite;
  private ballBody!: Matter.Body;
  private ballGraphic!: PIXI.Graphics;
  private brickEntities: BrickEntity[] = [];

  private moveDirection: -1 | 0 | 1 = 0;
  private doubleCoinsUntil = 0;
  private livesShieldUntil = 0;
  private isGameOver = false;
  private lives = START_LIVES;
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

  static async create(options: GameEngineOptions): Promise<BrickBreakerGame> {
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

    const texture = await BrickBreakerGame.loadTexture(options.textureSource);
    const engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } });

    const game = new BrickBreakerGame(app, engine, texture, options.sceneConfig, options);
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

  private addWall(x: number, y: number, width: number, height: number, label: string) {
    const graphic = new PIXI.Graphics().rect(-width / 2, -height / 2, width, height).fill(0x312e81);
    graphic.x = x;
    graphic.y = y;
    this.app.stage.addChild(graphic);
    this.worldGraphics.push(graphic);
    this.addBody(Matter.Bodies.rectangle(x, y, width, height, { isStatic: true, restitution: 1, label }));
  }

  /**
   * Cada moeda/obstáculo/powerup marcado no desenho vira um tijolo - só a
   * quantidade e (pra powerups) o tipo importam, igual ao Labirinto/Coleta de
   * Itens (a posição exata do desenho não faz sentido numa grade fixa).
   */
  private async buildWorld() {
    this.addWall(LEVEL_WIDTH / 2, WALL_THICKNESS / 2, LEVEL_WIDTH, WALL_THICKNESS, "wall");
    this.addWall(WALL_THICKNESS / 2, LEVEL_HEIGHT / 2, WALL_THICKNESS, LEVEL_HEIGHT, "wall");
    this.addWall(LEVEL_WIDTH - WALL_THICKNESS / 2, LEVEL_HEIGHT / 2, WALL_THICKNESS, LEVEL_HEIGHT, "wall");
    // Sem parede embaixo - é por ali que a bola cai quando a raquete erra.

    const columns = Math.max(
      1,
      Math.floor((LEVEL_WIDTH - 2 * (WALL_THICKNESS + 20) + BRICK_GAP) / (BRICK_WIDTH + BRICK_GAP)),
    );
    const maxBricks = columns * MAX_ROWS;

    type PendingBrick = { imageUrl?: string; powerup?: PowerupType };
    let pending: PendingBrick[] = [
      ...this.sceneConfig.coins.map((coin) => ({ imageUrl: coin.imageUrl })),
      ...this.sceneConfig.obstacles.map((obstacle) => ({ imageUrl: obstacle.imageUrl })),
      ...(this.sceneConfig.powerups ?? []).map((powerup) => ({ imageUrl: powerup.imageUrl, powerup: powerup.type })),
    ];
    while (pending.length < MIN_BRICKS) {
      pending.push({});
    }
    if (pending.length > maxBricks) {
      pending = pending.slice(0, maxBricks);
    }

    const gridWidth = columns * (BRICK_WIDTH + BRICK_GAP) - BRICK_GAP;
    const gridLeft = (LEVEL_WIDTH - gridWidth) / 2 + BRICK_WIDTH / 2;

    for (let index = 0; index < pending.length; index += 1) {
      const brick = pending[index];
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = gridLeft + col * (BRICK_WIDTH + BRICK_GAP);
      const y = GRID_TOP + row * (BRICK_HEIGHT + BRICK_GAP) + BRICK_HEIGHT / 2;

      const body = Matter.Bodies.rectangle(x, y, BRICK_WIDTH, BRICK_HEIGHT, {
        isStatic: true,
        restitution: 1,
        label: "brick",
      });
      this.addBody(body);

      const fillColor = brick.powerup ? POWERUP_COLORS[brick.powerup] : BRICK_COLORS[row % BRICK_COLORS.length];
      let graphic: PIXI.Container;
      if (brick.imageUrl) {
        const texture = await BrickBreakerGame.loadTexture(brick.imageUrl);
        const sprite = new PIXI.Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.width = BRICK_WIDTH;
        sprite.height = BRICK_HEIGHT;
        graphic = sprite;
      } else {
        graphic = new PIXI.Graphics().roundRect(-BRICK_WIDTH / 2, -BRICK_HEIGHT / 2, BRICK_WIDTH, BRICK_HEIGHT, 4).fill(fillColor);
      }
      graphic.x = x;
      graphic.y = y;
      this.app.stage.addChild(graphic);
      this.brickEntities.push({ body, graphic, powerup: brick.powerup });
    }

    this.paddleBody = Matter.Bodies.rectangle(LEVEL_WIDTH / 2, PADDLE_Y, PADDLE_WIDTH, PADDLE_HEIGHT, {
      inertia: Infinity,
      friction: 0,
      restitution: 0,
      label: "paddle",
    });
    this.addBody(this.paddleBody);

    this.paddleGraphic = new PIXI.Sprite(this.texture);
    this.paddleGraphic.anchor.set(0.5);
    this.paddleGraphic.width = PADDLE_WIDTH;
    this.paddleGraphic.height = PADDLE_HEIGHT;
    this.app.stage.addChild(this.paddleGraphic);

    this.ballGraphic = new PIXI.Graphics().circle(0, 0, BALL_RADIUS).fill(0xffffff);
    this.app.stage.addChild(this.ballGraphic);

    this.ballBody = Matter.Bodies.circle(0, 0, BALL_RADIUS, {
      restitution: 1,
      friction: 0,
      frictionAir: 0,
      label: "ball",
    });
    this.addBody(this.ballBody);
    this.launchBall();
  }

  private launchBall() {
    const x = this.paddleBody.position.x;
    const y = PADDLE_Y - PADDLE_HEIGHT / 2 - BALL_RADIUS - 4;
    Matter.Body.setPosition(this.ballBody, { x, y });
    Matter.Body.setVelocity(this.ballBody, { x: BALL_SPEED * 0.4, y: -BALL_SPEED * 0.9 });
  }

  private attachEvents() {
    Matter.Events.on(this.engine, "collisionStart", (event) => {
      for (const pair of event.pairs) {
        this.handleBallCollision(pair.bodyA, pair.bodyB);
        this.handleBallCollision(pair.bodyB, pair.bodyA);
      }
    });
  }

  private handleBallCollision(body: Matter.Body, other: Matter.Body) {
    if (body.label !== "ball" || this.isGameOver) return;

    if (other.label === "wall") {
      this.audio.playBounce();
      return;
    }

    if (other.label === "paddle") {
      // Deflexão clássica de quebra-blocos: quanto mais longe do centro da
      // raquete a bola bate, mais ela desvia pra esse lado - preserva a
      // velocidade total (só redistribui entre X e Y).
      const offset = (this.ballBody.position.x - this.paddleBody.position.x) / (PADDLE_WIDTH / 2);
      const clamped = Math.max(-1, Math.min(1, offset));
      const vx = clamped * BALL_SPEED;
      const vy = -Math.sqrt(Math.max(BALL_SPEED * BALL_SPEED - vx * vx, BALL_SPEED * 0.3));
      Matter.Body.setVelocity(this.ballBody, { x: vx, y: vy });
      this.audio.playBounce();
      return;
    }

    if (other.label === "brick") {
      const entity = this.brickEntities.find((brick) => brick.body === other);
      if (!entity) return;
      Matter.World.remove(this.engine.world, other);
      entity.graphic.destroy();
      this.brickEntities = this.brickEntities.filter((brick) => brick !== entity);

      if (entity.powerup) {
        this.applyPowerup(entity.powerup);
        this.audio.playPowerup();
      } else {
        this.coins += Date.now() < this.doubleCoinsUntil ? 2 : 1;
        this.callbacks.onCoinsChange?.(this.coins);
        this.audio.playCoin();
      }

      if (this.brickEntities.length === 0) {
        this.isGameOver = true;
        this.callbacks.onWin?.();
        this.audio.playWin();
      }
    }
  }

  private applyPowerup(type: PowerupType) {
    if (type === "extra_life") {
      this.lives += 1;
      this.callbacks.onLivesChange?.(this.lives);
    } else if (type === "shield") {
      this.livesShieldUntil = Math.max(this.livesShieldUntil, Date.now() + SHIELD_DURATION_MS);
    } else if (type === "double_coins") {
      this.doubleCoinsUntil = Date.now() + DOUBLE_COINS_DURATION_MS;
    }
  }

  private handleMiss() {
    if (Date.now() >= this.livesShieldUntil) {
      this.lives -= 1;
      this.callbacks.onLivesChange?.(this.lives);
      this.audio.playDamage();
    }
    if (this.lives <= 0) {
      this.isGameOver = true;
      this.callbacks.onLose?.();
      this.audio.playLose();
      return;
    }
    this.launchBall();
  }

  private attachTicker() {
    this.app.ticker.add((ticker) => {
      if (this.isGameOver) return;

      this.elapsedMs += ticker.deltaMS;
      Matter.Body.setVelocity(this.paddleBody, {
        x: this.moveDirection * PADDLE_SPEED,
        y: 0,
      });

      if (this.ballBody.position.y > LEVEL_HEIGHT + BALL_RADIUS) {
        this.handleMiss();
      }

      Matter.Engine.update(this.engine, ticker.deltaMS);

      this.paddleGraphic.x = this.paddleBody.position.x;
      this.paddleGraphic.y = this.paddleBody.position.y;
      this.ballGraphic.x = this.ballBody.position.x;
      this.ballGraphic.y = this.ballBody.position.y;
    });
  }

  moveLeft() {
    this.moveDirection = -1;
  }

  moveRight() {
    this.moveDirection = 1;
  }

  moveUp() {
    // Quebra-blocos não tem movimento vertical da raquete.
  }

  moveDown() {
    // Quebra-blocos não tem movimento vertical da raquete.
  }

  stopMove() {
    this.moveDirection = 0;
  }

  jump() {
    // Sem pulo neste template.
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
    for (const brick of this.brickEntities) {
      Matter.World.remove(this.engine.world, brick.body);
      brick.graphic.destroy();
    }
    this.paddleGraphic.destroy();
    this.ballGraphic.destroy();

    this.worldObjects = [];
    this.worldGraphics = [];
    this.brickEntities = [];
    this.moveDirection = 0;
    this.doubleCoinsUntil = 0;
    this.livesShieldUntil = 0;
    this.isGameOver = false;
    this.lives = START_LIVES;
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
