import { FLAG_X, GROUND_Y } from "@/game/level-constants";
import type { ElementRole } from "@/lib/element-roles";
import type { DetectedShape } from "@/lib/shape-detection";

export const SCENE_CONFIG_STORAGE_KEY = "mkgc.pendingSceneConfig";

export type PowerupType = "extra_life" | "shield" | "double_coins";

// Só se aplica a obstáculos do tipo "enemy" — default é "perseguidor" quando
// ausente, pra manter o comportamento de cenários já salvos antes desta fase.
export type EnemyBehavior = "patrulha" | "perseguidor" | "voador" | "saltador" | "atirador";

export type SceneConfig = {
  groundY: number;
  sky?: string;
  coins: { x: number; y: number; imageUrl?: string }[];
  obstacles: {
    type: "hazard" | "hop" | "enemy" | "destructible" | "dynamic";
    x: number;
    y: number;
    width: number;
    height: number;
    imageUrl?: string;
    enemyBehavior?: EnemyBehavior;
    visionRange?: number;
    speed?: number;
    shootIntervalMs?: number;
  }[];
  powerups: { x: number; y: number; type: PowerupType; imageUrl?: string }[];
  flag: { x: number; y: number };
};

export type TaggedShape = DetectedShape & { role: ElementRole };

// Exportadas pra apps/web/src/app/new-game/edit/page.tsx reaproveitar o mesmo
// range de posição/tamanho da marcação automática ao arrastar/redimensionar.
export const ELEMENT_START_X = 150;
export const ELEMENT_END_X = FLAG_X - 60;
export const COIN_HIGH_Y = GROUND_Y - 150;
export const COIN_LOW_Y = GROUND_Y - 40;
export const OBSTACLE_MIN_SIZE = 28;
const OBSTACLE_MAX_SIZE = 64;
const OBSTACLE_MAX_SCALE = 3;
const POWERUP_TYPES: PowerupType[] = ["shield", "extra_life", "double_coins"];

function mapX(shapeX: number, sourceWidth: number) {
  const u = sourceWidth > 0 ? shapeX / sourceWidth : 0.5;
  return Math.round(ELEMENT_START_X + u * (ELEMENT_END_X - ELEMENT_START_X));
}

function mapCoinY(shapeY: number, sourceHeight: number) {
  const v = sourceHeight > 0 ? shapeY / sourceHeight : 0.5;
  return Math.round(COIN_HIGH_Y + v * (COIN_LOW_Y - COIN_HIGH_Y));
}

function normalizeObstacleSize(width: number, height: number) {
  const largest = Math.max(width, height, 1);
  const scale = Math.min(OBSTACLE_MAX_SIZE / largest, OBSTACLE_MAX_SCALE);
  return {
    width: Math.max(OBSTACLE_MIN_SIZE, Math.round(width * scale)),
    height: Math.max(OBSTACLE_MIN_SIZE, Math.round(height * scale)),
  };
}

/**
 * Monta o sceneConfig real do jogo a partir das formas que a criança marcou
 * no desenho — posição X proporcional a onde foi desenhado (esquerda→direita
 * do desenho vira início→fim da fase); moedas/powerups flutuam no ar (mantém
 * a mecânica de pular pra pegar), pular/machuca ficam sempre no chão.
 */
export function buildSceneConfigFromShapes(
  elements: { shape: TaggedShape; imageUrl: string }[],
  sourceSize: { width: number; height: number },
  sky?: string,
): SceneConfig {
  const coins: SceneConfig["coins"] = [];
  const obstacles: SceneConfig["obstacles"] = [];
  const powerups: SceneConfig["powerups"] = [];

  for (const { shape, imageUrl } of elements) {
    const x = mapX(shape.x, sourceSize.width);

    if (shape.role === "moeda") {
      coins.push({ x, y: mapCoinY(shape.y, sourceSize.height), imageUrl });
      continue;
    }

    if (shape.role === "powerup") {
      const type = POWERUP_TYPES[powerups.length % POWERUP_TYPES.length];
      powerups.push({ x, y: mapCoinY(shape.y, sourceSize.height), type, imageUrl });
      continue;
    }

    if (
      shape.role === "pular" ||
      shape.role === "machuca" ||
      shape.role === "inimigo" ||
      shape.role === "destrutivel" ||
      shape.role === "dinamico"
    ) {
      const { width, height } = normalizeObstacleSize(shape.width, shape.height);
      const type =
        shape.role === "machuca"
          ? "hazard"
          : shape.role === "inimigo"
            ? "enemy"
            : shape.role === "destrutivel"
              ? "destructible"
              : shape.role === "dinamico"
                ? "dynamic"
                : "hop";
      obstacles.push({
        type,
        x,
        y: GROUND_Y - height / 2,
        width,
        height,
        imageUrl,
      });
    }
  }

  return {
    groundY: GROUND_Y,
    sky,
    coins,
    obstacles,
    powerups,
    flag: { x: FLAG_X, y: GROUND_Y - 80 },
  };
}
