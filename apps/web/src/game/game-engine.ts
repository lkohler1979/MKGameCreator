import type { SceneConfig } from "@/lib/scene-config-builder";

export type GameEngineCallbacks = {
  onCoinsChange?: (coins: number) => void;
  onLivesChange?: (lives: number) => void;
  onWin?: () => void;
  onLose?: () => void;
  // Só usado por templates com cronômetro regressivo (ex.: Coleta de Itens) -
  // Plataforma/Labirinto simplesmente nunca chamam.
  onTimeChange?: (secondsRemaining: number) => void;
};

export type GameEngineOptions = GameEngineCallbacks & {
  container: HTMLElement;
  sceneConfig: SceneConfig;
  textureSource: HTMLCanvasElement | string;
};

/**
 * Contrato comum a qualquer motor de jogo (Plataforma, Labirinto, futuros
 * templates) — a tela Jogar só conhece essa interface, nunca a classe
 * concreta, e escolhe qual motor importar conforme `Game.templateType`.
 */
export interface GameEngine {
  moveLeft(): void;
  moveRight(): void;
  moveUp(): void;
  moveDown(): void;
  stopMove(): void;
  jump(): void;
  toggleMute(): boolean;
  isMuted(): boolean;
  getElapsedSeconds(): number;
  getCoins(): number;
  getLives(): number;
  reset(): Promise<void>;
  requestFullscreen(): void;
  destroy(): void;
}
