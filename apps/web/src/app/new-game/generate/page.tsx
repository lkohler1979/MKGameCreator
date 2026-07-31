"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BrickWall, Check, CircleDot, Gamepad2, Gem, Grid3x3, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WizardHeader } from "@/components/wizard-header";
import { createGame, createSprite } from "@/lib/api";
import { SCENE_CONFIG_STORAGE_KEY, type SceneConfig } from "@/lib/scene-config-builder";
import { cn } from "@/lib/utils";

const STEPS = [
  "Analisando desenho...",
  "Removendo fundo...",
  "Criando personagem...",
  "Construindo cenário...",
];

const STEP_DURATION_MS = 700;

function GenerateScreenContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const source = searchParams.get("source");
  const spriteUrl = searchParams.get("spriteUrl");
  const originalUrl = searchParams.get("originalUrl") ?? undefined;
  const existingSpriteId = searchParams.get("spriteId") ?? undefined;
  const characterName = searchParams.get("name") ?? "Meu Personagem";

  const [stage, setStage] = useState<"select" | "generating" | "error">("select");
  const [activeStep, setActiveStep] = useState(-1);
  const [errorMessage, setErrorMessage] = useState("");
  const [templateType, setTemplateType] = useState<
    "PLATFORM" | "MAZE" | "COLLECT" | "BRICK_BREAKER" | "RACE" | "AIR_HOCKEY"
  >(
    () =>
      (searchParams.get("templateType") as
        | "PLATFORM"
        | "MAZE"
        | "COLLECT"
        | "BRICK_BREAKER"
        | "RACE"
        | "AIR_HOCKEY"
        | null) ?? "PLATFORM",
  );
  const [hasPendingScene, setHasPendingScene] = useState(false);

  useEffect(() => {
    setHasPendingScene(sessionStorage.getItem(SCENE_CONFIG_STORAGE_KEY) !== null);
  }, []);

  function editSceneHref() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("templateType", templateType);
    return `/new-game/edit?${params.toString()}`;
  }

  if (!source || !spriteUrl) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <WizardHeader title="Novo Jogo" backHref="/new-game/character" currentStep={3} totalSteps={4} />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum personagem selecionado. Volte e escolha um.
          </p>
        </main>
      </div>
    );
  }

  async function handleCreateGame() {
    if (!spriteUrl || !source) return;

    setStage("generating");

    // Etapas 1-2 são teatrais: o processamento real do desenho e a remoção de
    // fundo já aconteceram no upload (Sprint 2). Aqui só reforçam a "mágica"
    // pedida pelo PRD para a tela de geração.
    for (let index = 0; index < STEPS.length; index += 1) {
      setActiveStep(index);
      await new Promise((resolve) => setTimeout(resolve, STEP_DURATION_MS));
    }

    try {
      // Personagem já salvo (escolhido em "Meus Personagens") reaproveita o
      // Sprite existente em vez de criar um novo com as mesmas imagens.
      const spriteId = existingSpriteId
        ?? (
          await createSprite({
            source: source as "DRAWING" | "PRESET",
            originalImageUrl: originalUrl,
            spriteImageUrl: spriteUrl,
          })
        ).id;

      let sceneConfig: SceneConfig | undefined;
      const pending = sessionStorage.getItem(SCENE_CONFIG_STORAGE_KEY);
      if (pending) {
        try {
          sceneConfig = JSON.parse(pending) as SceneConfig;
        } catch {
          // sessionStorage corrompida/antiga — ignora e cai no template padrão do backend
        }
        sessionStorage.removeItem(SCENE_CONFIG_STORAGE_KEY);
      }

      const game = await createGame({
        spriteId,
        name: `${characterName} Run`,
        sceneConfig,
        templateType,
      });

      setActiveStep(STEPS.length);
      await new Promise((resolve) => setTimeout(resolve, 500));
      router.push(`/play/${game.id}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível criar o jogo.");
      setStage("error");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <WizardHeader title="Novo Jogo" backHref="/new-game/character" currentStep={3} totalSteps={4} />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8 sm:px-6 animate-fade-in-up">
        {stage === "select" || stage === "error" ? (
          <>
            <div className="flex flex-col gap-1 text-center">
              <h2 className="font-heading text-xl font-bold text-foreground">
                Escolha o tipo do jogo
              </h2>
              <p className="text-sm text-muted-foreground">Como você quer jogar?</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setTemplateType("PLATFORM")}
                className={cn(
                  "relative flex flex-col gap-1.5 rounded-2xl border-2 bg-card p-3 text-left transition-colors",
                  templateType === "PLATFORM" ? "border-primary" : "border-border",
                )}
              >
                {templateType === "PLATFORM" && (
                  <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                )}
                <div className="flex aspect-video items-center justify-center rounded-xl bg-secondary">
                  <Gamepad2 className="size-6 text-primary" />
                </div>
                <p className="font-heading text-sm font-bold text-foreground">Plataforma</p>
                <p className="text-[11px] text-muted-foreground">
                  Corra, pule e chegue à bandeira.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTemplateType("MAZE")}
                className={cn(
                  "relative flex flex-col gap-1.5 rounded-2xl border-2 bg-card p-3 text-left transition-colors",
                  templateType === "MAZE" ? "border-primary" : "border-border",
                )}
              >
                {templateType === "MAZE" && (
                  <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                )}
                <div className="flex aspect-video items-center justify-center rounded-xl bg-secondary">
                  <Grid3x3 className="size-6 text-primary" />
                </div>
                <p className="font-heading text-sm font-bold text-foreground">Labirinto</p>
                <p className="text-[11px] text-muted-foreground">
                  Encontre a saída do labirinto.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTemplateType("COLLECT")}
                className={cn(
                  "relative flex flex-col gap-1.5 rounded-2xl border-2 bg-card p-3 text-left transition-colors",
                  templateType === "COLLECT" ? "border-primary" : "border-border",
                )}
              >
                {templateType === "COLLECT" && (
                  <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                )}
                <div className="flex aspect-video items-center justify-center rounded-xl bg-secondary">
                  <Gem className="size-6 text-primary" />
                </div>
                <p className="font-heading text-sm font-bold text-foreground">Coleta de Itens</p>
                <p className="text-[11px] text-muted-foreground">
                  Pegue tudo antes do tempo acabar.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTemplateType("BRICK_BREAKER")}
                className={cn(
                  "relative flex flex-col gap-1.5 rounded-2xl border-2 bg-card p-3 text-left transition-colors",
                  templateType === "BRICK_BREAKER" ? "border-primary" : "border-border",
                )}
              >
                {templateType === "BRICK_BREAKER" && (
                  <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                )}
                <div className="flex aspect-video items-center justify-center rounded-xl bg-secondary">
                  <BrickWall className="size-6 text-primary" />
                </div>
                <p className="font-heading text-sm font-bold text-foreground">Quebra-blocos</p>
                <p className="text-[11px] text-muted-foreground">
                  Rebata a bola e quebre todos os blocos.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTemplateType("RACE")}
                className={cn(
                  "relative flex flex-col gap-1.5 rounded-2xl border-2 bg-card p-3 text-left transition-colors",
                  templateType === "RACE" ? "border-primary" : "border-border",
                )}
              >
                {templateType === "RACE" && (
                  <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                )}
                <div className="flex aspect-video items-center justify-center rounded-xl bg-secondary">
                  <Timer className="size-6 text-primary" />
                </div>
                <p className="font-heading text-sm font-bold text-foreground">Corrida</p>
                <p className="text-[11px] text-muted-foreground">
                  Pule os obstáculos e sobreviva o máximo possível.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTemplateType("AIR_HOCKEY")}
                className={cn(
                  "relative flex flex-col gap-1.5 rounded-2xl border-2 bg-card p-3 text-left transition-colors",
                  templateType === "AIR_HOCKEY" ? "border-primary" : "border-border",
                )}
              >
                {templateType === "AIR_HOCKEY" && (
                  <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                )}
                <div className="flex aspect-video items-center justify-center rounded-xl bg-secondary">
                  <CircleDot className="size-6 text-primary" />
                </div>
                <p className="font-heading text-sm font-bold text-foreground">Air Hockey</p>
                <p className="text-[11px] text-muted-foreground">
                  Rebata o disco pro gol e não deixe entrar no seu.
                </p>
              </button>
            </div>

            {stage === "error" && (
              <p className="text-center text-sm font-semibold text-destructive">{errorMessage}</p>
            )}

            {hasPendingScene && (
              <Link
                href={editSceneHref()}
                className="flex w-full items-center justify-center rounded-full border border-border py-3 text-sm font-semibold text-foreground"
              >
                Editar Cenário
              </Link>
            )}

            <Button variant="default" size="xl" className="w-full" onClick={handleCreateGame}>
              Criar Meu Jogo
            </Button>
          </>
        ) : (
          <div className="flex flex-1 flex-col justify-center gap-4">
            <h2 className="text-center font-heading text-xl font-bold text-foreground">
              {activeStep >= STEPS.length ? "Seu jogo está pronto!" : "Criando seu jogo..."}
            </h2>

            <div className="flex flex-col gap-3">
              {STEPS.map((label, index) => {
                const done = activeStep > index || activeStep >= STEPS.length;
                const active = activeStep === index;
                return (
                  <div key={label} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full",
                          done ? "bg-success text-success-foreground" : "bg-muted",
                        )}
                      >
                        {done && <Check className="size-3" />}
                      </span>
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          done || active ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {label}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full bg-primary transition-all",
                          done ? "w-full" : active ? "w-full duration-700" : "w-0",
                        )}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function GeneratePage() {
  return (
    <Suspense>
      <GenerateScreenContent />
    </Suspense>
  );
}
