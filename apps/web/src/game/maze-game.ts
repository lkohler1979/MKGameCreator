import Matter from "matter-js";
import * as PIXI from "pixi.js";

import { GameAudio } from "@/game/audio";
import type { GameEngine, GameEngineCallbacks, GameEngineOptions } from "@/game/game-engine";
import { LEVEL_HEIGHT, LEVEL_WIDTH } from "@/game/level-constants";
import type { PowerupType, SceneConfig } from "@/lib/scene-config-builder";

const COLS = 12;
const ROWS = 7;
const CELL_SIZE = 80;
const OFFSET_X = (LEVEL_WIDTH - COLS * CELL_SIZE) / 2;
const OFFSET_Y = (LEVEL_HEIGHT - ROWS * CELL_SIZE) / 2;
const WALL_THICKNESS = 8;
const PLAYER_RADIUS = 18;
const MOVE_SPEED = 4;
const COIN_RADIUS = 14;
const POWERUP_RADIUS = 16;
const HAZARD_SIZE = 36;
const EXIT_RADIUS = 26;
const START_LIVES = 3;
const INVULNERABILITY_MS = 1000;
const SHIELD_DURATION_MS = 5000;
const DOUBLE_COINS_DURATION_MS = 8000;
const DEFAULT_SKY_COLOR = 0x1f2937;

const POWERUP_COLORS: Record<PowerupType, number> = {
  extra_life: 0xef4444,
  shield: 0x60a5fa,
  double_coins: 0xffc736,
};

type Direction = "left" | "right" | "up" | "down" | null;

type MazeCell = { top: boolean; right: boolean; bottom: boolean; left: boolean };

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Gera o labirinto por recursive backtracker — um layout novo a cada partida. */
function generateMaze(): MazeCell[][] {
  const grid: MazeCell[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ top: true, right: true, bottom: true, left: true })),
  );
  const visited: boolean[][] = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));

  const NEIGHBORS = [
    { dc: 0, dr: -1, wall: "top", opposite: "bottom" },
    { dc: 1, dr: 0, wall: "right", opposite: "left" },
    { dc: 0, dr: 1, wall: "bottom", opposite: "top" },
    { dc: -1, dr: 0, wall: "left", opposite: "right" },
  ] as const;

  function carve(c: number, r: number) {
    visited[r][c] = true;
    for (const dir of shuffle([...NEIGHBORS])) {
      const nc = c + dir.dc;
      const nr = r + dir.dr;
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS || visited[nr][nc]) continue;
      grid[r][c][dir.wall] = false;
      grid[nr][nc][dir.opposite] = false;
      carve(nc, nr);
    }
  }

  carve(0, 0);
  return grid;
}

function cellCenter(c: number, r: number) {
  return { x: OFFSET_X + c * CELL_SIZE + CELL_SIZE / 2, y: OFFSET_Y + r * CELL_SIZE + CELL_SIZE / 2 };
}

function parseSkyColor(sky?: string): number {
  if (!sky) return DEFAULT_SKY_COLOR;
  const parsed = Number.parseInt(sky.replace("#", ""), 16);
  return Number.isNaN(parsed) ? DEFAULT_SKY_COLOR : parsed;
}

export class MazeGame implements GameEngine {
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

  private direction: Direction = null;
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
    callbacks: GameEngineCallbacks,
  ) {
    this.app = app;
    this.engine = engine;
    this.texture = texture;
    this.sceneConfig = sceneConfig;
    this.callbacks = callbacks;
  }

  static async create(options: GameEngineOptions): Promise<MazeGame> {
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

    const texture = await MazeGame.loadTexture(options.textureSource);
    const engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } });

    const game = new MazeGame(app, engine, texture, options.sceneConfig, options);
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

  private addWallGraphic(x: number, y: number, width: number, height: number) {
    const graphic = new PIXI.Graphics().rect(-width / 2, -height / 2, width, height).fill(0xe5e7eb);
    graphic.x = x;
    graphic.y = y;
    this.app.stage.addChild(graphic);
    this.worldGraphics.push(graphic);
    this.addBody(
      Matter.Bodies.rectangle(x, y, width, height, { isStatic: true, label: "wall" }),
    );
  }

  private async buildWorld() {
    const maze = generateMaze();

    const bgGraphic = new PIXI.Graphics()
      .rect(OFFSET_X, OFFSET_Y, COLS * CELL_SIZE, ROWS * CELL_SIZE)
      .fill(0x111827);
    this.app.stage.addChild(bgGraphic);
    this.worldGraphics.push(bgGraphic);

    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const cell = maze[r][c];
        if (c === 0 && cell.left) {
          this.addWallGraphic(OFFSET_X, OFFSET_Y + r * CELL_SIZE + CELL_SIZE / 2, WALL_THICKNESS, CELL_SIZE);
        }
        if (r === 0 && cell.top) {
          this.addWallGraphic(OFFSET_X + c * CELL_SIZE + CELL_SIZE / 2, OFFSET_Y, CELL_SIZE, WALL_THICKNESS);
        }
        if (cell.right) {
          this.addWallGraphic(
            OFFSET_X + (c + 1) * CELL_SIZE,
            OFFSET_Y + r * CELL_SIZE + CELL_SIZE / 2,
            WALL_THICKNESS,
            CELL_SIZE,
          );
        }
        if (cell.bottom) {
          this.addWallGraphic(
            OFFSET_X + c * CELL_SIZE + CELL_SIZE / 2,
            OFFSET_Y + (r + 1) * CELL_SIZE,
            CELL_SIZE,
            WALL_THICKNESS,
          );
        }
      }
    }

    // Células livres pra sortear moeda/machuca/powerup — exclui início e saída.
    const freeCells = shuffle(
      Array.from({ length: ROWS * COLS }, (_, index) => ({ c: index % COLS, r: Math.floor(index / COLS) })).filter(
        ({ c, r }) => !(c === 0 && r === 0) && !(c === COLS - 1 && r === ROWS - 1),
      ),
    );
    let nextFreeCellIndex = 0;
    const takeCell = () => freeCells[nextFreeCellIndex++];

    for (const coin of this.sceneConfig.coins) {
      const cell = takeCell();
      if (!cell) break;
      const { x, y } = cellCenter(cell.c, cell.r);
      const body = Matter.Bodies.circle(x, y, COIN_RADIUS, { isStatic: true, isSensor: true, label: "coin" });
      this.addBody(body);

      let graphic: PIXI.Container;
      if (coin.imageUrl) {
        const texture = await MazeGame.loadTexture(coin.imageUrl);
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
      const cell = takeCell();
      if (!cell) break;
      const { x, y } = cellCenter(cell.c, cell.r);
      // "hazard" tira vida (sensor); "hop" não tem pulo no labirinto, então vira
      // um bloco sólido — precisa desviar, igual a uma parede extra.
      const isHazard = obstacle.type === "hazard";
      const body = Matter.Bodies.rectangle(x, y, HAZARD_SIZE, HAZARD_SIZE, {
        isStatic: true,
        isSensor: isHazard,
        label: isHazard ? "hazard" : "hop",
      });
      this.addBody(body);

      let graphic: PIXI.Container;
      if (obstacle.imageUrl) {
        const texture = await MazeGame.loadTexture(obstacle.imageUrl);
        const sprite = new PIXI.Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.x = x;
        sprite.y = y;
        sprite.width = HAZARD_SIZE;
        sprite.height = HAZARD_SIZE;
        graphic = sprite;
      } else {
        graphic = new PIXI.Graphics()
          .poly([-HAZARD_SIZE / 2, HAZARD_SIZE / 2, HAZARD_SIZE / 2, HAZARD_SIZE / 2, 0, -HAZARD_SIZE / 2])
          .fill(isHazard ? 0xef4444 : 0x9ca3af);
        graphic.x = x;
        graphic.y = y;
      }
      this.app.stage.addChild(graphic);
      this.worldGraphics.push(graphic);
    }

    for (const powerup of this.sceneConfig.powerups ?? []) {
      const cell = takeCell();
      if (!cell) break;
      const { x, y } = cellCenter(cell.c, cell.r);
      const body = Matter.Bodies.circle(x, y, POWERUP_RADIUS, {
        isStatic: true,
        isSensor: true,
        label: `powerup:${powerup.type}`,
      });
      this.addBody(body);

      let graphic: PIXI.Container;
      if (powerup.imageUrl) {
        const texture = await MazeGame.loadTexture(powerup.imageUrl);
        const sprite = new PIXI.Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.x = x;
        sprite.y = y;
        sprite.width = POWERUP_RADIUS * 2;
        sprite.height = POWERUP_RADIUS * 2;
        graphic = sprite;
      } else {
        graphic = new PIXI.Graphics().star(x, y, 5, POWERUP_RADIUS, POWERUP_RADIUS / 2).fill(POWERUP_COLORS[powerup.type]);
      }
      this.app.stage.addChild(graphic);
      this.powerupEntities.push({ body, graphic, type: powerup.type });
    }

    const exitCenter = cellCenter(COLS - 1, ROWS - 1);
    const exitBody = Matter.Bodies.circle(exitCenter.x, exitCenter.y, EXIT_RADIUS, {
      isStatic: true,
      isSensor: true,
      label: "exit",
    });
    this.addBody(exitBody);
    const exitGraphic = new PIXI.Graphics().circle(exitCenter.x, exitCenter.y, EXIT_RADIUS).fill(0x22c55e);
    this.app.stage.addChild(exitGraphic);
    this.worldGraphics.push(exitGraphic);

    const startCenter = cellCenter(0, 0);
    this.playerBody = Matter.Bodies.circle(startCenter.x, startCenter.y, PLAYER_RADIUS, {
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

    if (other.label === "exit") {
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

      const velocity = { x: 0, y: 0 };
      if (this.direction === "left") velocity.x = -MOVE_SPEED;
      if (this.direction === "right") velocity.x = MOVE_SPEED;
      if (this.direction === "up") velocity.y = -MOVE_SPEED;
      if (this.direction === "down") velocity.y = MOVE_SPEED;
      Matter.Body.setVelocity(this.playerBody, velocity);

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
    // Labirinto não tem pulo — movimento livre em 4 direções.
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
    this.playerSprite.destroy();
    this.shieldGraphic.destroy();

    this.worldObjects = [];
    this.worldGraphics = [];
    this.coinEntities = [];
    this.powerupEntities = [];
    this.direction = null;
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
    Matter.Engine.clear(this.engine);
    this.audio.destroy();
    this.app.destroy(true, { children: true });
  }
}
