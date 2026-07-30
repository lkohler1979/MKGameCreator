"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/stepper";
import { getGame, updateGameScene } from "@/lib/api";
import { FLAG_X, GROUND_Y, LEVEL_HEIGHT, LEVEL_WIDTH } from "@/game/level-constants";
import {
  COIN_HIGH_Y,
  COIN_LOW_Y,
  ELEMENT_END_X,
  ELEMENT_START_X,
  OBSTACLE_MIN_SIZE,
  SCENE_CONFIG_STORAGE_KEY,
  type PowerupType,
  type SceneConfig,
} from "@/lib/scene-config-builder";
import { cn } from "@/lib/utils";

type ObstacleType = "hazard" | "hop" | "enemy" | "destructible" | "dynamic";
type TemplateType = "PLATFORM" | "MAZE" | "COLLECT";

const OBSTACLE_TYPE_META: { value: ObstacleType; label: string; emoji: string; color: string }[] = [
  { value: "hop", label: "Pular", emoji: "⬆️", color: "#9ca3af" },
  { value: "hazard", label: "Machuca", emoji: "💥", color: "#ef4444" },
  { value: "enemy", label: "Inimigo", emoji: "👾", color: "#ef4444" },
  { value: "destructible", label: "Destrutível", emoji: "🧱", color: "#9a7b4f" },
  { value: "dynamic", label: "Dinâmico", emoji: "🔀", color: "#8b5cf6" },
];

const POWERUP_TYPE_META: { value: PowerupType; label: string; emoji: string }[] = [
  { value: "shield", label: "Escudo", emoji: "🛡️" },
  { value: "extra_life", label: "Vida Extra", emoji: "❤️" },
  { value: "double_coins", label: "Moeda Dobrada", emoji: "✨" },
];

// Teto de redimensionamento manual — mais generoso que a normalização da
// detecção automática (scene-config-builder.ts), que existe pra outro fim.
const OBSTACLE_MAX_SIZE_MANUAL = 160;
const DEFAULT_OBSTACLE_SIZE = 40;
const DEFAULT_SKY_COLOR = "#8ecae6";

type EditorCoin = { id: string; x: number; y: number; imageUrl?: string };
type EditorObstacle = {
  id: string;
  type: ObstacleType;
  x: number;
  y: number;
  width: number;
  height: number;
  imageUrl?: string;
};
type EditorPowerup = { id: string; x: number; y: number; type: PowerupType; imageUrl?: string };

type Selected = { kind: "coin" | "obstacle" | "powerup"; id: string } | null;

function makeId() {
  return Math.random().toString(36).slice(2);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function EditPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameId = searchParams.get("gameId") ?? undefined;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [templateType, setTemplateType] = useState<TemplateType>("PLATFORM");
  const [groundY, setGroundY] = useState(GROUND_Y);
  const [sky, setSky] = useState<string | undefined>(undefined);
  const [flag, setFlag] = useState({ x: FLAG_X, y: GROUND_Y - 80 });
  const [coins, setCoins] = useState<EditorCoin[]>([]);
  const [obstacles, setObstacles] = useState<EditorObstacle[]>([]);
  const [powerups, setPowerups] = useState<EditorPowerup[]>([]);
  const [selected, setSelected] = useState<Selected>(null);

  useEffect(() => {
    if (gameId) {
      getGame(gameId)
        .then((game) => {
          setTemplateType(game.templateType as TemplateType);
          loadSceneConfig(game.sceneConfig);
          setLoading(false);
        })
        .catch((error) => {
          setLoadError(error instanceof Error ? error.message : "Não foi possível carregar o jogo.");
          setLoading(false);
        });
      return;
    }

    const pending = sessionStorage.getItem(SCENE_CONFIG_STORAGE_KEY);
    const paramTemplate = (searchParams.get("templateType") as TemplateType | null) ?? "PLATFORM";
    setTemplateType(paramTemplate);
    if (!pending) {
      setLoadError("Não há elementos marcados para editar neste desenho.");
      setLoading(false);
      return;
    }
    try {
      loadSceneConfig(JSON.parse(pending) as SceneConfig);
    } catch {
      setLoadError("Não foi possível carregar o cenário.");
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  function loadSceneConfig(sceneConfig: SceneConfig) {
    setGroundY(sceneConfig.groundY);
    setSky(sceneConfig.sky);
    setFlag(sceneConfig.flag);
    setCoins(sceneConfig.coins.map((coin) => ({ id: makeId(), ...coin })));
    setObstacles(sceneConfig.obstacles.map((obstacle) => ({ id: makeId(), ...obstacle })));
    setPowerups(sceneConfig.powerups.map((powerup) => ({ id: makeId(), ...powerup })));
  }

  function buildSceneConfig(): SceneConfig {
    return {
      groundY,
      sky,
      flag,
      coins: coins.map((coin) => ({ x: coin.x, y: coin.y, imageUrl: coin.imageUrl })),
      obstacles: obstacles.map((obstacle) => ({
        type: obstacle.type,
        x: obstacle.x,
        y: obstacle.y,
        width: obstacle.width,
        height: obstacle.height,
        imageUrl: obstacle.imageUrl,
      })),
      powerups: powerups.map((powerup) => ({
        x: powerup.x,
        y: powerup.y,
        type: powerup.type,
        imageUrl: powerup.imageUrl,
      })),
    };
  }

  function addCoin() {
    const id = makeId();
    setCoins((prev) => [...prev, { id, x: (ELEMENT_START_X + ELEMENT_END_X) / 2, y: COIN_LOW_Y }]);
    setSelected({ kind: "coin", id });
  }

  function addObstacle() {
    const id = makeId();
    setObstacles((prev) => [
      ...prev,
      {
        id,
        type: "hop",
        x: (ELEMENT_START_X + ELEMENT_END_X) / 2,
        y: groundY - DEFAULT_OBSTACLE_SIZE / 2,
        width: DEFAULT_OBSTACLE_SIZE,
        height: DEFAULT_OBSTACLE_SIZE,
      },
    ]);
    setSelected({ kind: "obstacle", id });
  }

  function addPowerup() {
    const id = makeId();
    setPowerups((prev) => [
      ...prev,
      { id, x: (ELEMENT_START_X + ELEMENT_END_X) / 2, y: COIN_HIGH_Y, type: "shield" },
    ]);
    setSelected({ kind: "powerup", id });
  }

  function deleteSelected() {
    if (!selected) return;
    if (selected.kind === "coin") setCoins((prev) => prev.filter((c) => c.id !== selected.id));
    if (selected.kind === "obstacle") setObstacles((prev) => prev.filter((o) => o.id !== selected.id));
    if (selected.kind === "powerup") setPowerups((prev) => prev.filter((p) => p.id !== selected.id));
    setSelected(null);
  }

  async function handleSave() {
    setSaveError(null);
    const sceneConfig = buildSceneConfig();
    if (templateType === "COLLECT" && sceneConfig.coins.length === 0) {
      setSaveError("Adicione pelo menos 1 moeda para o jogo poder ser vencido.");
      return;
    }

    if (gameId) {
      setSaving(true);
      try {
        await updateGameScene(gameId, sceneConfig);
        router.push(`/play/${gameId}`);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Não foi possível salvar o cenário.");
        setSaving(false);
      }
      return;
    }

    sessionStorage.setItem(SCENE_CONFIG_STORAGE_KEY, JSON.stringify(sceneConfig));
    router.push(`/new-game/generate?${searchParams.toString()}`);
  }

  const backHref = gameId ? `/play/${gameId}` : `/new-game/generate?${searchParams.toString()}`;

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4 text-center">
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <Link href={backHref} className="text-sm font-semibold text-primary">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {gameId ? (
        <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-4 sm:px-6">
          <Link
            href={backHref}
            aria-label="Voltar"
            className="flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="font-heading text-lg font-bold text-foreground">Editar Cenário</h1>
        </header>
      ) : (
        <header className="flex flex-col items-center gap-4 border-b border-border bg-card px-4 py-4 sm:px-6">
          <div className="flex w-full max-w-md items-center gap-3">
            <Link
              href={backHref}
              aria-label="Voltar"
              className="flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <h1 className="font-heading text-lg font-bold text-foreground">Editar Cenário</h1>
          </div>
          <Stepper currentStep={3} totalSteps={4} />
        </header>
      )}

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        {templateType === "PLATFORM" ? (
          <PlatformEditor
            groundY={groundY}
            sky={sky}
            flag={flag}
            coins={coins}
            obstacles={obstacles}
            powerups={powerups}
            setCoins={setCoins}
            setObstacles={setObstacles}
            setPowerups={setPowerups}
            selected={selected}
            setSelected={setSelected}
          />
        ) : (
          <ListEditor
            coins={coins}
            obstacles={obstacles}
            powerups={powerups}
            setObstacles={setObstacles}
            setPowerups={setPowerups}
            deleteCoin={(id) => setCoins((prev) => prev.filter((c) => c.id !== id))}
            deleteObstacle={(id) => setObstacles((prev) => prev.filter((o) => o.id !== id))}
            deletePowerup={(id) => setPowerups((prev) => prev.filter((p) => p.id !== id))}
            onAddCoin={addCoin}
            onAddObstacle={addObstacle}
            onAddPowerup={addPowerup}
          />
        )}

        {templateType === "PLATFORM" && (
          <>
            {selected && (
              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {selected.kind === "obstacle" &&
                    OBSTACLE_TYPE_META.map((meta) => {
                      const current = obstacles.find((o) => o.id === selected.id);
                      return (
                        <button
                          key={meta.value}
                          type="button"
                          onClick={() =>
                            setObstacles((prev) =>
                              prev.map((o) => (o.id === selected.id ? { ...o, type: meta.value } : o)),
                            )
                          }
                          className={cn(
                            "flex size-8 items-center justify-center rounded-lg text-base",
                            current?.type === meta.value ? "bg-primary/15" : "hover:bg-muted",
                          )}
                          aria-label={meta.label}
                        >
                          {meta.emoji}
                        </button>
                      );
                    })}
                  {selected.kind === "powerup" &&
                    POWERUP_TYPE_META.map((meta) => {
                      const current = powerups.find((p) => p.id === selected.id);
                      return (
                        <button
                          key={meta.value}
                          type="button"
                          onClick={() =>
                            setPowerups((prev) =>
                              prev.map((p) => (p.id === selected.id ? { ...p, type: meta.value } : p)),
                            )
                          }
                          className={cn(
                            "flex size-8 items-center justify-center rounded-lg text-base",
                            current?.type === meta.value ? "bg-primary/15" : "hover:bg-muted",
                          )}
                          aria-label={meta.label}
                        >
                          {meta.emoji}
                        </button>
                      );
                    })}
                  {selected.kind === "coin" && (
                    <span className="px-2 text-sm text-muted-foreground">🪙 Moeda selecionada</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={deleteSelected}
                  aria-label="Excluir"
                  className="flex size-8 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm" onClick={addCoin}>
                <Plus className="size-4" /> Moeda
              </Button>
              <Button variant="outline" size="sm" onClick={addObstacle}>
                <Plus className="size-4" /> Obstáculo
              </Button>
              <Button variant="outline" size="sm" onClick={addPowerup}>
                <Plus className="size-4" /> Powerup
              </Button>
            </div>
          </>
        )}

        {saveError && <p className="text-center text-sm font-semibold text-destructive">{saveError}</p>}

        <Button variant="default" size="xl" className="w-full" onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </main>
    </div>
  );
}

function PlatformEditor({
  groundY,
  sky,
  flag,
  coins,
  obstacles,
  powerups,
  setCoins,
  setObstacles,
  setPowerups,
  selected,
  setSelected,
}: {
  groundY: number;
  sky?: string;
  flag: { x: number; y: number };
  coins: EditorCoin[];
  obstacles: EditorObstacle[];
  powerups: EditorPowerup[];
  setCoins: React.Dispatch<React.SetStateAction<EditorCoin[]>>;
  setObstacles: React.Dispatch<React.SetStateAction<EditorObstacle[]>>;
  setPowerups: React.Dispatch<React.SetStateAction<EditorPowerup[]>>;
  selected: Selected;
  setSelected: (selected: Selected) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    kind: "coin" | "obstacle" | "powerup" | "resize";
    id: string;
    startClientX: number;
    startClientY: number;
    startWorldX: number;
    startWorldY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  function startDrag(
    event: React.PointerEvent,
    kind: "coin" | "obstacle" | "powerup" | "resize",
    id: string,
    worldX: number,
    worldY: number,
    width = 0,
    height = 0,
  ) {
    event.stopPropagation();
    if (kind !== "resize") setSelected({ kind, id });
    (event.target as Element).setPointerCapture(event.pointerId);
    dragRef.current = {
      kind,
      id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startWorldX: worldX,
      startWorldY: worldY,
      startWidth: width,
      startHeight: height,
    };
  }

  function handlePointerMove(event: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const deltaWorldX = ((event.clientX - drag.startClientX) / rect.width) * LEVEL_WIDTH;
    const deltaWorldY = ((event.clientY - drag.startClientY) / rect.height) * LEVEL_HEIGHT;

    if (drag.kind === "resize") {
      const width = clamp(drag.startWidth + deltaWorldX, OBSTACLE_MIN_SIZE, OBSTACLE_MAX_SIZE_MANUAL);
      const height = clamp(drag.startHeight + deltaWorldY, OBSTACLE_MIN_SIZE, OBSTACLE_MAX_SIZE_MANUAL);
      setObstacles((prev) =>
        prev.map((o) => (o.id === drag.id ? { ...o, width, height, y: groundY - height / 2 } : o)),
      );
      return;
    }

    const x = clamp(drag.startWorldX + deltaWorldX, ELEMENT_START_X, ELEMENT_END_X);
    if (drag.kind === "obstacle") {
      setObstacles((prev) => prev.map((o) => (o.id === drag.id ? { ...o, x } : o)));
    } else if (drag.kind === "coin") {
      const y = clamp(drag.startWorldY + deltaWorldY, COIN_HIGH_Y, COIN_LOW_Y);
      setCoins((prev) => prev.map((c) => (c.id === drag.id ? { ...c, x, y } : c)));
    } else if (drag.kind === "powerup") {
      const y = clamp(drag.startWorldY + deltaWorldY, COIN_HIGH_Y, COIN_LOW_Y);
      setPowerups((prev) => prev.map((p) => (p.id === drag.id ? { ...p, x, y } : p)));
    }
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  return (
    <div
      ref={containerRef}
      className="relative aspect-[25/14] w-full overflow-hidden rounded-2xl border-2 border-border"
      style={{ backgroundColor: sky ?? DEFAULT_SKY_COLOR }}
      onPointerDown={() => setSelected(null)}
    >
      <div
        className="absolute inset-x-0 bottom-0 bg-[#8b5a2b]"
        style={{ top: `${(groundY / LEVEL_HEIGHT) * 100}%` }}
      />
      <div
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-2xl"
        style={{ left: `${(flag.x / LEVEL_WIDTH) * 100}%`, top: `${(flag.y / LEVEL_HEIGHT) * 100}%` }}
      >
        🚩
      </div>

      {coins.map((coin) => (
        <button
          key={coin.id}
          type="button"
          onPointerDown={(e) => startDrag(e, "coin", coin.id, coin.x, coin.y)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute flex size-6 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center rounded-full bg-[#ffc736] text-xs shadow",
            selected?.kind === "coin" && selected.id === coin.id && "ring-2 ring-primary ring-offset-1",
          )}
          style={{ left: `${(coin.x / LEVEL_WIDTH) * 100}%`, top: `${(coin.y / LEVEL_HEIGHT) * 100}%` }}
          aria-label="Moeda"
        />
      ))}

      {powerups.map((powerup) => (
        <button
          key={powerup.id}
          type="button"
          onPointerDown={(e) => startDrag(e, "powerup", powerup.id, powerup.x, powerup.y)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute flex size-7 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center rounded-full bg-[#60a5fa] text-sm shadow",
            selected?.kind === "powerup" && selected.id === powerup.id && "ring-2 ring-primary ring-offset-1",
          )}
          style={{ left: `${(powerup.x / LEVEL_WIDTH) * 100}%`, top: `${(powerup.y / LEVEL_HEIGHT) * 100}%` }}
          aria-label="Powerup"
        >
          {POWERUP_TYPE_META.find((m) => m.value === powerup.type)?.emoji}
        </button>
      ))}

      {obstacles.map((obstacle) => {
        const meta = OBSTACLE_TYPE_META.find((m) => m.value === obstacle.type);
        const isSelected = selected?.kind === "obstacle" && selected.id === obstacle.id;
        return (
          <div
            key={obstacle.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${(obstacle.x / LEVEL_WIDTH) * 100}%`,
              top: `${(obstacle.y / LEVEL_HEIGHT) * 100}%`,
              width: `${(obstacle.width / LEVEL_WIDTH) * 100}%`,
              height: `${(obstacle.height / LEVEL_HEIGHT) * 100}%`,
            }}
          >
            <button
              type="button"
              onPointerDown={(e) => startDrag(e, "obstacle", obstacle.id, obstacle.x, obstacle.y)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onClick={(e) => e.stopPropagation()}
              className={cn("size-full touch-none", isSelected && "ring-2 ring-primary ring-offset-1")}
              style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)", backgroundColor: meta?.color }}
              aria-label={meta?.label}
            />
            {isSelected && (
              <div
                onPointerDown={(e) =>
                  startDrag(e, "resize", obstacle.id, obstacle.x, obstacle.y, obstacle.width, obstacle.height)
                }
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onClick={(e) => e.stopPropagation()}
                className="absolute -bottom-2 -right-2 size-6 touch-none cursor-nwse-resize rounded-full border-2 border-white bg-primary"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ListEditor({
  coins,
  obstacles,
  powerups,
  setObstacles,
  setPowerups,
  deleteCoin,
  deleteObstacle,
  deletePowerup,
  onAddCoin,
  onAddObstacle,
  onAddPowerup,
}: {
  coins: EditorCoin[];
  obstacles: EditorObstacle[];
  powerups: EditorPowerup[];
  setObstacles: React.Dispatch<React.SetStateAction<EditorObstacle[]>>;
  setPowerups: React.Dispatch<React.SetStateAction<EditorPowerup[]>>;
  deleteCoin: (id: string) => void;
  deleteObstacle: (id: string) => void;
  deletePowerup: (id: string) => void;
  onAddCoin: () => void;
  onAddObstacle: () => void;
  onAddPowerup: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Neste template a posição é sorteada a cada partida — só a quantidade e o tipo de cada elemento importam.
      </p>

      <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-sm font-bold text-foreground">🪙 Moedas ({coins.length})</h3>
          <Button variant="outline" size="icon-sm" onClick={onAddCoin} aria-label="Adicionar moeda">
            <Plus className="size-4" />
          </Button>
        </div>
        {coins.map((coin) => (
          <div key={coin.id} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
            <span className="text-sm text-foreground">🪙 Moeda</span>
            <button
              type="button"
              onClick={() => deleteCoin(coin.id)}
              aria-label="Excluir moeda"
              className="text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-sm font-bold text-foreground">Obstáculos ({obstacles.length})</h3>
          <Button variant="outline" size="icon-sm" onClick={onAddObstacle} aria-label="Adicionar obstáculo">
            <Plus className="size-4" />
          </Button>
        </div>
        {obstacles.map((obstacle) => {
          const meta = OBSTACLE_TYPE_META.find((m) => m.value === obstacle.type);
          return (
            <div key={obstacle.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
              <span className="text-sm text-foreground">
                {meta?.emoji} {meta?.label}
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={obstacle.type}
                  onChange={(e) =>
                    setObstacles((prev) =>
                      prev.map((o) =>
                        o.id === obstacle.id ? { ...o, type: e.target.value as ObstacleType } : o,
                      ),
                    )
                  }
                  className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
                >
                  {OBSTACLE_TYPE_META.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.emoji} {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => deleteObstacle(obstacle.id)}
                  aria-label="Excluir obstáculo"
                  className="text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-sm font-bold text-foreground">Powerups ({powerups.length})</h3>
          <Button variant="outline" size="icon-sm" onClick={onAddPowerup} aria-label="Adicionar powerup">
            <Plus className="size-4" />
          </Button>
        </div>
        {powerups.map((powerup) => {
          const meta = POWERUP_TYPE_META.find((m) => m.value === powerup.type);
          return (
            <div key={powerup.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
              <span className="text-sm text-foreground">
                {meta?.emoji} {meta?.label}
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={powerup.type}
                  onChange={(e) =>
                    setPowerups((prev) =>
                      prev.map((p) =>
                        p.id === powerup.id ? { ...p, type: e.target.value as PowerupType } : p,
                      ),
                    )
                  }
                  className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
                >
                  {POWERUP_TYPE_META.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.emoji} {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => deletePowerup(powerup.id)}
                  aria-label="Excluir powerup"
                  className="text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

export default function EditPage() {
  return (
    <Suspense>
      <EditPageContent />
    </Suspense>
  );
}
