import Matter from "matter-js";
import * as PIXI from "pixi.js";

import { GameAudio } from "@/game/audio";
import type { GameEngine, GameEngineCallbacks, GameEngineOptions } from "@/game/game-engine";
import { LEVEL_HEIGHT, LEVEL_WIDTH } from "@/game/level-constants";
import type { PowerupType, SceneConfig } from "@/lib/scene-config-builder";

export type { SceneConfig };
export type PlatformGameCallbacks = GameEngineCallbacks;
export type PlatformGameOptions = GameEngineOptions;

const GROUND_THICKNESS = 60;
const PLAYER_SIZE = 48;
const MOVE_SPEED = 4;
const JUMP_VELOCITY = -14;
const COIN_RADIUS = 14;
const POWERUP_RADIUS = 16;
const OBSTACLE_SIZE = 36;
const FLAG_SIZE = 56;
const START_LIVES = 3;
const INVULNERABILITY_MS = 1000;
const SHIELD_DURATION_MS = 5000;
const DOUBLE_COINS_DURATION_MS = 8000;
const DEFAULT_SKY_COLOR = 0x8ecae6;
const PATROL_AMPLITUDE = 40;
const PATROL_ANGULAR_SPEED = (2 * Math.PI) / 3000;

const POWERUP_COLORS: Record<PowerupType, number> = {
  extra_life: 0xef4444,
  shield: 0x60a5fa,
  double_coins: 0xffc736,
};

function parseSkyColor(sky?: string): number {
  if (!sky) return DEFAULT_SKY_COLOR;
  const parsed = Number.parseInt(sky.replace("#", ""), 16);
  return Number.isNaN(parsed) ? DEFAULT_SKY_COLOR : parsed;
}

export class PlatformGame implements GameEngine {
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
  private hazardEntities: { body: Matter.Body; graphic: PIXI.Container; spawnX: number; spawnY: number }[] = [];

  private moveDirection: -1 | 0 | 1 = 0;
  private groundContacts = 0;
  private invulnerableUntil = 0;
  private doubleCoinsUntil = 0;
  private isGameOver = false;
  private lives = START_LIVES;
  private coins = 0;
  private elapsedMs = 0;

  private constructor(
    app: PIXI.Application,
    engine: Matter.Engine,
    texture: PIXI.Texture,
    sceneConfig: SceneConfig,
    callbacks: PlatformGameCallbacks,
  ) {
    this.app = app;
    this.engine = engine;
    this.texture = texture;
    this.sceneConfig = sceneConfig;
    this.callbacks = callbacks;
  }

  static async create(options: PlatformGameOptions): Promise<PlatformGame> {
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

    const texture = await PlatformGame.loadTexture(options.textureSource);

    const engine = Matter.Engine.create({ gravity: { x: 0, y: 1 } });

    const game = new PlatformGame(app, engine, texture, options.sceneConfig, options);
    await game.buildWorld();
    game.attachEvents();
    game.attachTicker();
    game.audio.startMusic();
    return game;
  }

  private static async loadTexture(source: HTMLCanvasElement | string): Promise<PIXI.Texture> {
    return typeof source === "string" ? await PIXI.Assets.load(source) : PIXI.Texture.from(source);
  }

  private async buildWorld() {
    const { groundY, coins, obstacles, flag } = this.sceneConfig;
    const powerups = this.sceneConfig.powerups ?? [];

    const ground = Matter.Bodies.rectangle(
      LEVEL_WIDTH / 2,
      groundY + GROUND_THICKNESS / 2,
      LEVEL_WIDTH + 200,
      GROUND_THICKNESS,
      { isStatic: true, label: "ground" },
    );
    this.addBody(ground);
    const groundGraphic = new PIXI.Graphics()
      .rect(0, groundY, LEVEL_WIDTH, GROUND_THICKNESS)
      .fill(0x8b5a2b)
      .rect(0, groundY, LEVEL_WIDTH, 10)
      .fill(0x4caf50);
    this.app.stage.addChild(groundGraphic);
    this.worldGraphics.push(groundGraphic);

    for (const obstacle of obstacles) {
      // "hazard" tira vida e patrulha de um lado a outro (inimigo simples);
      // "hop" é sólido e parado — o personagem precisa pular por cima, sem
      // penalidade se encostar.
      const isHazard = obstacle.type === "hazard";
      const width = obstacle.width ?? OBSTACLE_SIZE;
      const height = obstacle.height ?? OBSTACLE_SIZE;

      const body = Matter.Bodies.rectangle(obstacle.x, obstacle.y, width, height, {
        isStatic: true,
        isSensor: isHazard,
        label: isHazard ? "hazard" : "hop",
      });
      this.addBody(body);

      // Geometria desenhada relativa à origem (0,0) e posicionada via
      // .x/.y do container — assim sprite e gráfico genérico se movem da
      // mesma forma (necessário pra patrulha dos "hazard" abaixo).
      let obstacleGraphic: PIXI.Container;
      if (obstacle.imageUrl) {
        const texture = await PlatformGame.loadTexture(obstacle.imageUrl);
        const sprite = new PIXI.Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.width = width;
        sprite.height = height;
        obstacleGraphic = sprite;
      } else {
        obstacleGraphic = new PIXI.Graphics()
          .poly([-width / 2, height / 2, width / 2, height / 2, 0, -height / 2])
          .fill(isHazard ? 0xef4444 : 0x9ca3af);
      }
      obstacleGraphic.x = obstacle.x;
      obstacleGraphic.y = obstacle.y;
      this.app.stage.addChild(obstacleGraphic);

      if (isHazard) {
        this.hazardEntities.push({ body, graphic: obstacleGraphic, spawnX: obstacle.x, spawnY: obstacle.y });
      } else {
        this.worldGraphics.push(obstacleGraphic);
      }
    }

    for (const coin of coins) {
      const body = Matter.Bodies.circle(coin.x, coin.y, COIN_RADIUS, {
        isStatic: true,
        isSensor: true,
        label: "coin",
      });
      this.addBody(body);

      let graphic: PIXI.Container;
      if (coin.imageUrl) {
        const texture = await PlatformGame.loadTexture(coin.imageUrl);
        const sprite = new PIXI.Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.x = coin.x;
        sprite.y = coin.y;
        sprite.width = COIN_RADIUS * 2;
        sprite.height = COIN_RADIUS * 2;
        graphic = sprite;
      } else {
        graphic = new PIXI.Graphics().circle(coin.x, coin.y, COIN_RADIUS).fill(0xffc736);
      }
      this.app.stage.addChild(graphic);
      this.coinEntities.push({ body, graphic });
    }

    for (const powerup of powerups) {
      const body = Matter.Bodies.circle(powerup.x, powerup.y, POWERUP_RADIUS, {
        isStatic: true,
        isSensor: true,
        label: `powerup:${powerup.type}`,
      });
      this.addBody(body);

      let graphic: PIXI.Container;
      if (powerup.imageUrl) {
        const texture = await PlatformGame.loadTexture(powerup.imageUrl);
        const sprite = new PIXI.Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.x = powerup.x;
        sprite.y = powerup.y;
        sprite.width = POWERUP_RADIUS * 2;
        sprite.height = POWERUP_RADIUS * 2;
        graphic = sprite;
      } else {
        graphic = new PIXI.Graphics()
          .star(powerup.x, powerup.y, 5, POWERUP_RADIUS, POWERUP_RADIUS / 2)
          .fill(POWERUP_COLORS[powerup.type]);
      }
      this.app.stage.addChild(graphic);
      this.powerupEntities.push({ body, graphic, type: powerup.type });
    }

    // O mastro precisa encostar no chão (groundY) para o jogador tocar o
    // sensor andando normalmente — se parasse em "flag.y" ele ficaria
    // flutuando acima da cabeça do personagem e a vitória nunca disparava.
    const poleTop = flag.y - FLAG_SIZE;
    const poleBottom = groundY;
    const poleHeight = poleBottom - poleTop;
    const poleCenterY = poleTop + poleHeight / 2;

    const flagBody = Matter.Bodies.rectangle(flag.x, poleCenterY, 10, poleHeight, {
      isStatic: true,
      isSensor: true,
      label: "flag",
    });
    this.addBody(flagBody);
    const flagGraphic = new PIXI.Graphics()
      .rect(flag.x - 4, poleTop, 8, poleHeight)
      .fill(0x6b7280)
      .poly([flag.x + 4, poleTop, flag.x + 34, poleTop + 12, flag.x + 4, poleTop + 24])
      .fill(0xef4444);
    this.app.stage.addChild(flagGraphic);
    this.worldGraphics.push(flagGraphic);

    this.playerBody = Matter.Bodies.rectangle(80, groundY - PLAYER_SIZE / 2 - 2, PLAYER_SIZE, PLAYER_SIZE, {
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
  }

  private addBody(body: Matter.Body) {
    Matter.World.add(this.engine.world, body);
    this.worldObjects.push(body);
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
    return (
      (a.label === "player" && b.label === "ground") ||
      (b.label === "player" && a.label === "ground")
    );
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
      Matter.Body.setVelocity(this.playerBody, { x: -3, y: -8 });
      this.lives -= 1;
      this.callbacks.onLivesChange?.(this.lives);
      this.audio.playDamage();
      if (this.lives <= 0) {
        this.isGameOver = true;
        this.callbacks.onLose?.();
        this.audio.playLose();
      }
    }

    if (other.label === "flag") {
      this.isGameOver = true;
      this.callbacks.onWin?.();
      this.audio.playWin();
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
      Matter.Body.setVelocity(this.playerBody, {
        x: this.moveDirection * MOVE_SPEED,
        y: this.playerBody.velocity.y,
      });

      for (const hazard of this.hazardEntities) {
        const offset = Math.sin(this.elapsedMs * PATROL_ANGULAR_SPEED) * PATROL_AMPLITUDE;
        const x = hazard.spawnX + offset;
        Matter.Body.setPosition(hazard.body, { x, y: hazard.spawnY });
        hazard.graphic.x = x;
        hazard.graphic.y = hazard.spawnY;
      }

      Matter.Engine.update(this.engine, ticker.deltaMS);

      this.playerSprite.x = this.playerBody.position.x;
      this.playerSprite.y = this.playerBody.position.y;
      this.playerSprite.scale.x = this.moveDirection < 0 ? -1 : 1;

      this.shieldGraphic.x = this.playerBody.position.x;
      this.shieldGraphic.y = this.playerBody.position.y;
      this.shieldGraphic.visible = Date.now() < this.invulnerableUntil;
    });
  }

  moveLeft() {
    this.moveDirection = -1;
  }

  moveRight() {
    this.moveDirection = 1;
  }

  moveUp() {
    // Plataforma não tem movimento vertical livre — pular é feito por jump().
  }

  moveDown() {
    // Plataforma não tem movimento vertical livre — pular é feito por jump().
  }

  stopMove() {
    this.moveDirection = 0;
  }

  jump() {
    if (this.groundContacts > 0 && !this.isGameOver) {
      Matter.Body.setVelocity(this.playerBody, { x: this.playerBody.velocity.x, y: JUMP_VELOCITY });
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
    for (const coin of this.coinEntities) {
      Matter.World.remove(this.engine.world, coin.body);
      coin.graphic.destroy();
    }
    for (const powerup of this.powerupEntities) {
      Matter.World.remove(this.engine.world, powerup.body);
      powerup.graphic.destroy();
    }
    for (const hazard of this.hazardEntities) {
      Matter.World.remove(this.engine.world, hazard.body);
      hazard.graphic.destroy();
    }
    this.playerSprite.destroy();
    this.shieldGraphic.destroy();

    this.worldObjects = [];
    this.worldGraphics = [];
    this.coinEntities = [];
    this.powerupEntities = [];
    this.hazardEntities = [];
    this.moveDirection = 0;
    this.groundContacts = 0;
    this.invulnerableUntil = 0;
    this.doubleCoinsUntil = 0;
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
    Matter.Events.off(this.engine, "collisionEnd", undefined as never);
    Matter.Engine.clear(this.engine);
    this.audio.destroy();
    this.app.destroy(true, { children: true });
  }
}
