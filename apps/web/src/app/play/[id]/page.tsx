"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Clock,
  Coins,
  Expand,
  Heart,
  Link as LinkIcon,
  Pencil,
  Plus,
  RotateCcw,
  Share2,
  Star,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import type { GameEngine, GameEngineOptions } from "@/game/game-engine";
import { createGameSession, getGame, getGameRanking, type GameDetail, type RankingEntry } from "@/lib/api";
import { PRESET_CHARACTERS } from "@/lib/preset-characters";
import { rasterizeEmoji } from "@/lib/rasterize-emoji";

const START_LIVES = 3;

function resolveTextureSource(sprite: GameDetail["sprite"]) {
  if (sprite.source === "DRAWING") return sprite.spriteImageUrl;

  const presetId = sprite.spriteImageUrl.replace("preset:", "");
  const preset = PRESET_CHARACTERS.find((item) => item.id === presetId);
  return rasterizeEmoji(preset?.emoji ?? "🎮");
}

export default function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameEngine | null>(null);
  const resultSavedRef = useRef(false);

  // Ajusta o tamanho real do canvas ao espaço disponível (não só à largura) -
  // sem isso, uma tela alta e estreita (celular) deixa a área de jogo minúscula
  // porque aspect-ratio + w-full sempre resolve pela largura, mesmo quando a
  // altura disponível é bem menor que a largura x (14/25).
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const wrapper = canvasWrapperRef.current;
    if (!wrapper) return;

    const RATIO = 25 / 14;

    function updateSize() {
      const style = getComputedStyle(wrapper!);
      const paddingX = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
      const paddingY = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
      const availableWidth = wrapper!.clientWidth - paddingX;
      const availableHeight = wrapper!.clientHeight - paddingY;

      let width = Math.min(availableWidth, 896); // equivalente ao max-w-4xl anterior
      let height = width / RATIO;
      if (height > availableHeight) {
        height = availableHeight;
        width = height * RATIO;
      }
      setCanvasSize({ width, height });
    }

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  const [gameData, setGameData] = useState<GameDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [coins, setCoins] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [result, setResult] = useState<"win" | "lose" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [ranking, setRanking] = useState<RankingEntry[] | null>(null);
  const [showRanking, setShowRanking] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    getGame(id)
      .then(setGameData)
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Erro ao carregar o jogo"));
  }, [id]);

  useEffect(() => {
    if (!gameData || !containerRef.current) return;

    let cancelled = false;

    async function saveSession(completed: boolean) {
      if (resultSavedRef.current || !gameRef.current) return;
      resultSavedRef.current = true;
      try {
        await createGameSession(id, {
          completed,
          timeSeconds: gameRef.current.getElapsedSeconds(),
          coinsCollected: gameRef.current.getCoins(),
          livesRemaining: gameRef.current.getLives(),
        });
      } catch {
        // resultado da partida é secundário à experiência de jogo; falha aqui não deve travar a UI
      }
    }

    // Ambos os motores implementam GameEngine, mas TS não unifica os dois
    // `static create` diretamente — a assinatura comum é explicitada aqui.
    type EngineClass = { create(options: GameEngineOptions): Promise<GameEngine> };
    const engineModule: Promise<EngineClass> =
      gameData.templateType === "MAZE"
        ? import("@/game/maze-game").then((mod) => mod.MazeGame as unknown as EngineClass)
        : gameData.templateType === "COLLECT"
          ? import("@/game/collect-game").then((mod) => mod.CollectGame as unknown as EngineClass)
          : gameData.templateType === "BRICK_BREAKER"
            ? import("@/game/brick-breaker-game").then((mod) => mod.BrickBreakerGame as unknown as EngineClass)
            : gameData.templateType === "RACE"
              ? import("@/game/race-game").then((mod) => mod.RaceGame as unknown as EngineClass)
              : gameData.templateType === "AIR_HOCKEY"
                ? import("@/game/air-hockey-game").then((mod) => mod.AirHockeyGame as unknown as EngineClass)
                : import("@/game/platform-game").then((mod) => mod.PlatformGame as unknown as EngineClass);

    engineModule
      .then((Engine) =>
        Engine.create({
          container: containerRef.current!,
          sceneConfig: gameData.sceneConfig,
          textureSource: resolveTextureSource(gameData.sprite),
          onCoinsChange: setCoins,
          onLivesChange: setLives,
          onWin: () => {
            setResult("win");
            void saveSession(true);
          },
          onLose: () => {
            setResult("lose");
            void saveSession(false);
          },
          onTimeChange: setTimeRemaining,
        }),
      )
      .then((game) => {
        if (cancelled) {
          game.destroy();
          return;
        }
        gameRef.current = game;
      });

    return () => {
      cancelled = true;
      gameRef.current?.destroy();
      gameRef.current = null;
    };
  }, [gameData, id]);

  useEffect(() => {
    // Labirinto, Coleta de Itens e Air Hockey usam o mesmo modelo de
    // movimento livre em 4 direções (sem gravidade/pulo) — Plataforma e
    // Corrida são os únicos com pulo real.
    const isFreeMovement =
      gameData?.templateType === "MAZE" ||
      gameData?.templateType === "COLLECT" ||
      gameData?.templateType === "AIR_HOCKEY";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") gameRef.current?.moveLeft();
      if (event.key === "ArrowRight") gameRef.current?.moveRight();
      // ArrowUp cobre os três motores: pula na Plataforma, anda pra cima nos
      // outros — o método do motor inativo é sempre um no-op.
      if (event.key === "ArrowUp") gameRef.current?.moveUp();
      if (event.key === "ArrowDown") gameRef.current?.moveDown();
      if (event.key === "ArrowUp" || event.key === " ") gameRef.current?.jump();
    }
    function handleKeyUp(event: KeyboardEvent) {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") gameRef.current?.stopMove();
      // Só solta o movimento no keyup de cima/baixo em movimento livre — na
      // Plataforma isso zeraria o moveDirection horizontal por engano.
      if (isFreeMovement && (event.key === "ArrowUp" || event.key === "ArrowDown")) gameRef.current?.stopMove();
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [gameData]);

  useEffect(() => {
    if (result === "win") {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    }
  }, [result]);

  async function handleRestart() {
    resultSavedRef.current = false;
    setResult(null);
    setFeedback(null);
    setCoins(0);
    setLives(START_LIVES);
    await gameRef.current?.reset();
  }

  function handleToggleMute() {
    if (!gameRef.current) return;
    setMuted(gameRef.current.toggleMute());
  }

  async function handleShowRanking() {
    setShowRanking(true);
    const entries = await getGameRanking(id);
    setRanking(entries);
  }

  function getShareUrl() {
    return `${window.location.origin}/play/${id}`;
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(getShareUrl());
      setFeedback("Link copiado!");
    } catch {
      setFeedback("Não foi possível copiar o link.");
    }
    setTimeout(() => setFeedback(null), 2000);
  }

  async function handleShare() {
    const shareData = {
      title: gameData?.name ?? "Meu jogo",
      text: `Joguei "${gameData?.name}" no MK Game Creator! 🎮`,
      url: getShareUrl(),
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // usuário cancelou o compartilhamento nativo — não precisa de feedback de erro
      }
    } else {
      await handleCopyLink();
    }
  }

  const totalCoins = gameData?.sceneConfig.coins.length ?? 0;
  const starCount = totalCoins > 0 ? Math.max(1, Math.round((coins / totalCoins) * 5)) : 5;

  const editHref = `/new-game/edit?gameId=${id}`;

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-center">
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <Link href="/home" className="text-sm font-semibold text-primary">
          Voltar para Home
        </Link>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-[#8ecae6]">
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {Array.from({ length: lives }, (_, index) => (
            <Heart key={index} className="size-6" fill="#ef4444" stroke="#ef4444" />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-white/80 px-3 py-1">
            <Coins className="size-4 text-cta" />
            <span className="font-heading text-sm font-bold">{coins}</span>
          </div>
          {(gameData?.templateType === "COLLECT" || gameData?.templateType === "RACE") && timeRemaining !== null && (
            <div className="flex items-center gap-1 rounded-full bg-white/80 px-3 py-1">
              <Clock className="size-4 text-foreground" />
              <span className="font-heading text-sm font-bold">{timeRemaining}s</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Ver ranking"
            onClick={handleShowRanking}
            className="flex size-9 items-center justify-center rounded-full bg-white/80 text-foreground"
          >
            <Trophy className="size-5" />
          </button>
          <button
            type="button"
            aria-label={muted ? "Ativar som" : "Silenciar som"}
            onClick={handleToggleMute}
            className="flex size-9 items-center justify-center rounded-full bg-white/80 text-foreground"
          >
            {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>
          <Link
            href="/home"
            aria-label="Sair do jogo"
            className="flex size-9 items-center justify-center rounded-full bg-white/80 text-foreground"
          >
            <X className="size-5" />
          </Link>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-16 z-10 hidden justify-center px-4 max-sm:portrait:flex">
        <div className="flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
          <RotateCcw className="size-3.5" />
          Gire o celular para uma tela maior
        </div>
      </div>

      <div ref={canvasWrapperRef} className="flex flex-1 items-center justify-center p-4 pt-16">
        <div
          className="overflow-hidden rounded-2xl shadow-lg animate-fade-in-up"
          style={canvasSize.width ? { width: canvasSize.width, height: canvasSize.height } : undefined}
          ref={containerRef}
        />
      </div>

      <div className="flex items-center justify-between px-4 pb-6">
        {gameData?.templateType === "MAZE" ||
        gameData?.templateType === "COLLECT" ||
        gameData?.templateType === "AIR_HOCKEY" ? (
          <div className="grid grid-cols-3 grid-rows-3 gap-1.5">
            <div />
            <button
              type="button"
              aria-label="Mover para cima"
              onPointerDown={() => gameRef.current?.moveUp()}
              onPointerUp={() => gameRef.current?.stopMove()}
              onPointerLeave={() => gameRef.current?.stopMove()}
              className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-95"
            >
              <ArrowUp className="size-5" />
            </button>
            <div />
            <button
              type="button"
              aria-label="Mover para esquerda"
              onPointerDown={() => gameRef.current?.moveLeft()}
              onPointerUp={() => gameRef.current?.stopMove()}
              onPointerLeave={() => gameRef.current?.stopMove()}
              className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-95"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div />
            <button
              type="button"
              aria-label="Mover para direita"
              onPointerDown={() => gameRef.current?.moveRight()}
              onPointerUp={() => gameRef.current?.stopMove()}
              onPointerLeave={() => gameRef.current?.stopMove()}
              className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-95"
            >
              <ArrowLeft className="size-5 rotate-180" />
            </button>
            <div />
            <button
              type="button"
              aria-label="Mover para baixo"
              onPointerDown={() => gameRef.current?.moveDown()}
              onPointerUp={() => gameRef.current?.stopMove()}
              onPointerLeave={() => gameRef.current?.stopMove()}
              className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-95"
            >
              <ArrowDown className="size-5" />
            </button>
            <div />
          </div>
        ) : gameData?.templateType === "BRICK_BREAKER" ? (
          <div className="flex gap-3">
            <button
              type="button"
              aria-label="Mover raquete para esquerda"
              onPointerDown={() => gameRef.current?.moveLeft()}
              onPointerUp={() => gameRef.current?.stopMove()}
              onPointerLeave={() => gameRef.current?.stopMove()}
              className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-95"
            >
              <ArrowLeft className="size-6" />
            </button>
            <button
              type="button"
              aria-label="Mover raquete para direita"
              onPointerDown={() => gameRef.current?.moveRight()}
              onPointerUp={() => gameRef.current?.stopMove()}
              onPointerLeave={() => gameRef.current?.stopMove()}
              className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-95"
            >
              <ArrowLeft className="size-6 rotate-180" />
            </button>
          </div>
        ) : gameData?.templateType === "RACE" ? (
          <button
            type="button"
            aria-label="Pular"
            onPointerDown={() => gameRef.current?.jump()}
            className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-95"
          >
            <ArrowLeft className="size-7 rotate-90" />
          </button>
        ) : (
          <>
            <div className="flex gap-3">
              <button
                type="button"
                aria-label="Mover para esquerda"
                onPointerDown={() => gameRef.current?.moveLeft()}
                onPointerUp={() => gameRef.current?.stopMove()}
                onPointerLeave={() => gameRef.current?.stopMove()}
                className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-95"
              >
                <ArrowLeft className="size-6" />
              </button>
              <button
                type="button"
                aria-label="Mover para direita"
                onPointerDown={() => gameRef.current?.moveRight()}
                onPointerUp={() => gameRef.current?.stopMove()}
                onPointerLeave={() => gameRef.current?.stopMove()}
                className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-95"
              >
                <ArrowLeft className="size-6 rotate-180" />
              </button>
            </div>

            <button
              type="button"
              aria-label="Pular"
              onPointerDown={() => gameRef.current?.jump()}
              className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-95"
            >
              <ArrowLeft className="size-7 rotate-90" />
            </button>
          </>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Reiniciar"
            onClick={handleRestart}
            className="flex size-10 items-center justify-center rounded-xl bg-white/80 text-foreground shadow-sm"
          >
            <RotateCcw className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Tela cheia"
            onClick={() => gameRef.current?.requestFullscreen()}
            className="flex size-10 items-center justify-center rounded-xl bg-white/80 text-foreground shadow-sm"
          >
            <Expand className="size-4" />
          </button>
        </div>
      </div>

      {result === "win" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
          <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-card p-6 text-center animate-fade-in-up">
            <h2 className="font-heading text-2xl font-bold text-foreground">Parabéns! 🎉</h2>
            <p className="text-sm text-muted-foreground">Você criou seu primeiro jogo.</p>

            <div className="flex gap-1">
              {Array.from({ length: 5 }, (_, index) => (
                <Star
                  key={index}
                  className="size-7"
                  fill={index < starCount ? "#FFC736" : "transparent"}
                  stroke="#FFC736"
                />
              ))}
            </div>

            <div className="flex w-full gap-3">
              <div className="flex flex-1 flex-col items-center gap-0.5 rounded-xl bg-muted py-3">
                <span className="text-xs font-semibold text-muted-foreground">Tempo</span>
                <span className="font-heading font-bold text-foreground">
                  {gameRef.current?.getElapsedSeconds() ?? 0}s
                </span>
              </div>
              <div className="flex flex-1 flex-col items-center gap-0.5 rounded-xl bg-muted py-3">
                <span className="text-xs font-semibold text-muted-foreground">Moedas</span>
                <span className="font-heading font-bold text-foreground">{coins}</span>
              </div>
            </div>

            {feedback && <p className="text-xs font-semibold text-success">{feedback}</p>}

            <button
              type="button"
              onClick={handleRestart}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 font-bold text-primary-foreground"
            >
              <RotateCcw className="size-4" />
              Jogar Novamente
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-border py-3 font-bold text-foreground"
            >
              <Share2 className="size-4" />
              Compartilhar
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-border py-3 font-bold text-foreground"
            >
              <LinkIcon className="size-4" />
              Copiar Link
            </button>

            <div className="flex w-full gap-3">
              <Link
                href={editHref}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border py-2.5 text-sm font-semibold text-foreground"
              >
                <Pencil className="size-4" />
                Editar
              </Link>
              <Link
                href="/new-game"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border py-2.5 text-sm font-semibold text-foreground"
              >
                <Plus className="size-4" />
                Criar Outro
              </Link>
            </div>

            <Link href="/home" className="text-sm font-semibold text-muted-foreground">
              Fechar e escolher outro jogo
            </Link>
          </div>
        </div>
      )}

      {result === "lose" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
          <div className="flex w-full max-w-xs flex-col items-center gap-4 rounded-2xl bg-card p-6 text-center animate-fade-in-up">
            <h2 className="font-heading text-2xl font-bold text-foreground">Fim de jogo</h2>
            <p className="text-sm text-muted-foreground">
              Moedas: {coins} · Tempo: {gameRef.current?.getElapsedSeconds() ?? 0}s
            </p>
            <button
              type="button"
              onClick={handleRestart}
              className="w-full rounded-full bg-primary py-3 font-bold text-primary-foreground"
            >
              Reiniciar
            </button>
            <Link href="/home" className="text-sm font-semibold text-muted-foreground">
              Voltar para Home
            </Link>
          </div>
        </div>
      )}

      {showRanking && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-card p-6 animate-fade-in-up">
            <div className="flex items-center gap-2">
              <Trophy className="size-6 text-cta" />
              <h2 className="font-heading text-xl font-bold text-foreground">Ranking</h2>
            </div>

            {ranking === null ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : ranking.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ninguém completou esse jogo ainda. Seja o primeiro!
              </p>
            ) : (
              <ol className="flex flex-col gap-2">
                {ranking.map((entry, index) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between rounded-xl bg-muted px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-sm font-bold text-muted-foreground">
                        {index + 1}º
                      </span>
                      <span className="text-sm font-semibold text-foreground">{entry.playerName}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                      <Coins className="size-3.5 text-cta" />
                      {entry.coinsCollected}
                      {entry.timeSeconds != null && <span>· {entry.timeSeconds}s</span>}
                    </div>
                  </li>
                ))}
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowRanking(false)}
              className="w-full rounded-full bg-primary py-3 font-bold text-primary-foreground"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
