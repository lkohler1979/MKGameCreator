import type { EnemyBehavior } from "@/lib/scene-config-builder";

// Compartilhado entre platform-game.ts e collect-game.ts — matemática pura de
// decisão de movimento/disparo dos inimigos, sem depender de PIXI/Matter.
// Cada motor ainda cria seus próprios corpos/gráficos; isso só decide "pra
// onde ele deveria ir" e "ele deveria atirar agora?".

export const ENEMY_DEFAULT_SPEED = 1.5;
export const ENEMY_DEFAULT_VISION_RANGE = 150;
export const ENEMY_SHOOT_INTERVAL_MS = 2000;
export const PROJECTILE_SPEED = 4;
export const PROJECTILE_SIZE = 10;
export const PROJECTILE_LIFETIME_MS = 3000;

const PATROL_AMPLITUDE = 40;
const PATROL_ANGULAR_SPEED = (2 * Math.PI) / 3000;
const JUMP_INTERVAL_MS = 1600;
const JUMP_DURATION_MS = 500;
const JUMP_HEIGHT = 50;

export type Vec2 = { x: number; y: number };

/** Deslocamento senoidal de patrulha (mesmo padrão já usado pelo hazard/dynamic) — `phase` desincroniza vários inimigos entre si. */
export function patrolOffset(elapsedMs: number, phase = 0): number {
  return Math.sin(elapsedMs * PATROL_ANGULAR_SPEED + phase) * PATROL_AMPLITUDE;
}

/** Deslocamento vertical do salto periódico (comportamento "saltador") — negativo = sobe na tela. */
export function jumpOffset(elapsedMs: number, phase = 0): number {
  const t = (elapsedMs + phase) % JUMP_INTERVAL_MS;
  if (t > JUMP_DURATION_MS) return 0;
  return -Math.sin((t / JUMP_DURATION_MS) * Math.PI) * JUMP_HEIGHT;
}

/** O jogador está dentro do alcance de visão do inimigo? */
export function canSeePlayer(enemyPos: Vec2, playerPos: Vec2, visionRange: number): boolean {
  return Math.hypot(playerPos.x - enemyPos.x, playerPos.y - enemyPos.y) <= visionRange;
}

/**
 * Posição alvo do inimigo neste tick. "perseguidor"/"voador" perseguem só
 * enquanto o jogador está no campo de visão (senão patrulham, como
 * "patrulha"/"atirador"); `allowVerticalChase` diferencia perseguidor
 * (só eixo X, preso ao chão) de voador (X e Y livres).
 */
export function computeEnemyTarget(
  behavior: EnemyBehavior,
  spawn: Vec2,
  current: Vec2,
  playerPos: Vec2,
  elapsedMs: number,
  stepPerTick: number,
  visionRange: number,
  phase: number,
  allowVerticalChase: boolean,
): Vec2 {
  const isChaser = behavior === "perseguidor" || behavior === "voador";

  if (isChaser && canSeePlayer(current, playerPos, visionRange)) {
    const dx = playerPos.x - current.x;
    const dy = allowVerticalChase ? playerPos.y - current.y : 0;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) return current;
    return {
      x: current.x + (dx / distance) * stepPerTick,
      y: allowVerticalChase ? current.y + (dy / distance) * stepPerTick : spawn.y,
    };
  }

  return { x: spawn.x + patrolOffset(elapsedMs, phase), y: spawn.y };
}

/** Verdadeiro só no momento em que o "atirador" deve disparar — respeita o intervalo e exige o jogador visível. */
export function shouldShoot(
  lastShotAt: number,
  now: number,
  intervalMs: number,
  enemyPos: Vec2,
  playerPos: Vec2,
  visionRange: number,
): boolean {
  return now - lastShotAt >= intervalMs && canSeePlayer(enemyPos, playerPos, visionRange);
}

/** Vetor unitário de `from` até `to` — usado para direcionar o projétil do "atirador". */
export function aimDirection(from: Vec2, to: Vec2): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy) || 1;
  return { x: dx / distance, y: dy / distance };
}
