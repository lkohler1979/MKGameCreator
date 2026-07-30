"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  Cloud,
  FolderOpen,
  Loader2,
  RotateCcw,
  RotateCw,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { WizardHeader } from "@/components/wizard-header";
import { getColorConfig, uploadImage } from "@/lib/api";
import { DEFAULT_COLOR_ROLE_MAP, matchColorToRole } from "@/lib/color-roles";
import { ROLE_OPTIONS, type ElementRole } from "@/lib/element-roles";
import { loadImageToCanvas, rotateImageFile, type RotationDegrees } from "@/lib/image-utils";
import {
  buildSceneConfigFromShapes,
  SCENE_CONFIG_STORAGE_KEY,
  type TaggedShape,
} from "@/lib/scene-config-builder";
import {
  backgroundColorToHex,
  buildForegroundMask,
  detectShapes,
  sampleBackgroundColor,
  sampleShapeColor,
} from "@/lib/shape-detection";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/heic", "image/heif"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const DETECTION_MAX_DIMENSION = 1024;

type Stage = "idle" | "rotate" | "processing" | "tagging" | "result" | "error";

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "Formato não suportado. Use PNG, JPG ou HEIC.";
  }
  if (file.size > MAX_SIZE_BYTES) {
    return "Imagem muito grande. O tamanho máximo é 10MB.";
  }
  return null;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Não foi possível gerar a imagem."));
    }, "image/png");
  });
}

// Papel quase branco ou fotos muito escuras não rendem um "céu" interessante
// — nesses casos mantém o azul padrão do motor em vez da cor amostrada.
function isUsableSkyColor([r, g, b]: [number, number, number]): boolean {
  const isNearWhite = r > 235 && g > 235 && b > 235;
  const isNearBlack = r < 20 && g < 20 && b < 20;
  return !isNearWhite && !isNearBlack;
}

export default function UploadPage() {
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("idle");
  const [processingLabel, setProcessingLabel] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [rotation, setRotation] = useState<RotationDegrees>(0);
  const [rotatePreviewUrl, setRotatePreviewUrl] = useState<string | null>(null);

  const [shapes, setShapes] = useState<TaggedShape[]>([]);
  const [detectionSize, setDetectionSize] = useState({ width: 0, height: 0 });
  const [skyColor, setSkyColor] = useState<string | undefined>(undefined);
  const [activeShapeId, setActiveShapeId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  function beginRotateStage(file: File) {
    const validationError = validateFile(file);
    if (validationError) {
      setErrorMessage(validationError);
      setStage("error");
      return;
    }

    setPendingFile(file);
    setRotation(0);
    setRotatePreviewUrl(URL.createObjectURL(file));
    setStage("rotate");
  }

  async function processFile(file: File) {
    setStage("processing");

    try {
      // TODO(sprint-0): "análise do desenho" e moderação de conteúdo reais
      // dependem do provedor de IA ainda não escolhido. Por ora só simula o
      // passo visual e sempre aprova.
      setProcessingLabel("Verificando conteúdo...");
      await new Promise((resolve) => setTimeout(resolve, 400));

      setProcessingLabel("Removendo fundo...");
      const { removeBackground } = await import("@imgly/background-removal");
      const resultBlob = await removeBackground(file);

      setProcessingLabel("Detectando elementos...");
      // A remoção de fundo por IA isola só "o assunto principal" da imagem e
      // descarta elementos desenhados separadamente — por isso a detecção de
      // formas roda sobre uma máscara de fundo mais literal (cor), construída
      // a partir da foto original já rotacionada, não do resultado da IA.
      const originalCanvas = await loadImageToCanvas(file, DETECTION_MAX_DIMENSION);
      const foregroundMask = buildForegroundMask(originalCanvas);
      const detected = detectShapes(foregroundMask);
      setDetectionSize({ width: foregroundMask.width, height: foregroundMask.height });

      const backgroundRgb = sampleBackgroundColor(originalCanvas);
      setSkyColor(isUsableSkyColor(backgroundRgb) ? backgroundColorToHex(backgroundRgb) : undefined);

      // A maior forma continua sempre "personagem" (heurística de tamanho,
      // não de cor) — as demais ganham uma sugestão inicial de categoria
      // baseada na cor média da própria forma + configuração de cores do
      // usuário (apps/web/src/app/configuracoes/cores), caindo em "moeda"
      // quando a cor não bate com nada configurado. A criança ainda pode
      // trocar qualquer marcação normalmente.
      const colorConfig = (await getColorConfig().catch(() => null)) ?? DEFAULT_COLOR_ROLE_MAP;
      setShapes(
        detected.map((shape, index) => ({
          ...shape,
          role:
            index === 0
              ? "personagem"
              : (matchColorToRole(sampleShapeColor(shape), colorConfig) ?? "moeda"),
        })),
      );

      setProcessingLabel("Enviando imagens...");
      const [uploadedOriginal, uploadedResult] = await Promise.all([
        uploadImage(file, file.name),
        uploadImage(resultBlob, "sprite.png"),
      ]);

      setOriginalUrl(uploadedOriginal);
      setResultUrl(uploadedResult);
      setStage(detected.length > 0 ? "tagging" : "result");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível processar a imagem.",
      );
      setStage("error");
    }
  }

  async function handleRotateConfirm() {
    if (!pendingFile) return;
    try {
      const rotatedFile = await rotateImageFile(pendingFile, rotation, pendingFile.name);
      await processFile(rotatedFile);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível rotacionar a imagem.");
      setStage("error");
    }
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) beginRotateStage(file);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) beginRotateStage(file);
  }

  function setShapeRole(shapeId: string, role: ElementRole) {
    setShapes((prev) =>
      prev.map((shape) => {
        if (shape.id === shapeId) return { ...shape, role };
        if (role === "personagem" && shape.role === "personagem") return { ...shape, role: "moeda" };
        return shape;
      }),
    );
    setActiveShapeId(null);
  }

  function handleTaggingContinue() {
    setShapes((prev) => {
      if (prev.some((shape) => shape.role === "personagem")) return prev;
      const fallback = prev.find((shape) => shape.role !== "ignorar") ?? prev[0];
      return prev.map((shape) =>
        shape.id === fallback?.id ? { ...shape, role: "personagem" } : shape,
      );
    });
    setStage("result");
  }

  async function handleFinalContinue() {
    if (!originalUrl || !resultUrl) return;
    setIsFinalizing(true);

    try {
      const personagem = shapes.find((shape) => shape.role === "personagem") ?? null;
      const elements = shapes.filter(
        (shape) =>
          shape.role === "moeda" ||
          shape.role === "pular" ||
          shape.role === "machuca" ||
          shape.role === "powerup" ||
          shape.role === "inimigo" ||
          shape.role === "destrutivel" ||
          shape.role === "dinamico",
      );

      const [characterUrl, elementUrls] = await Promise.all([
        personagem
          ? canvasToBlob(personagem.canvas).then((blob) => uploadImage(blob, "character.png"))
          : Promise.resolve(resultUrl),
        Promise.all(
          elements.map((shape) =>
            canvasToBlob(shape.canvas).then((blob) => uploadImage(blob, `${shape.role}.png`)),
          ),
        ),
      ]);

      if (elements.length > 0 || skyColor) {
        const sceneConfig = buildSceneConfigFromShapes(
          elements.map((shape, index) => ({ shape, imageUrl: elementUrls[index] })),
          detectionSize,
          skyColor,
        );
        sessionStorage.setItem(SCENE_CONFIG_STORAGE_KEY, JSON.stringify(sceneConfig));
      } else {
        sessionStorage.removeItem(SCENE_CONFIG_STORAGE_KEY);
      }

      const params = new URLSearchParams({ original: originalUrl, sprite: characterUrl });
      router.push(`/new-game/character?${params.toString()}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível continuar.");
      setStage("error");
      setIsFinalizing(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <WizardHeader title="Novo Jogo" backHref="/home" currentStep={1} totalSteps={4} />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8 sm:px-6 animate-fade-in-up">
        {(stage === "idle" || stage === "error") && (
          <>
            <div className="flex flex-col gap-1 text-center">
              <h2 className="font-heading text-xl font-bold text-foreground">
                Faça upload do seu desenho
              </h2>
              <p className="text-sm text-muted-foreground">
                Use um desenho seu para criar o personagem
              </p>
            </div>

            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card py-14 text-center transition-colors hover:border-primary"
            >
              <Cloud className="size-10 text-muted-foreground" />
              <p className="font-semibold text-foreground">Arraste sua imagem aqui</p>
              <p className="text-sm text-muted-foreground">ou</p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    cameraInputRef.current?.click();
                  }}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}
                >
                  <Camera className="size-4" />
                  Tirar Foto
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}
                >
                  <FolderOpen className="size-4" />
                  Escolher Arquivo
                </button>
              </div>

              <p className="text-xs text-muted-foreground">PNG, JPG ou HEIC</p>
            </div>

            {stage === "error" && (
              <p className="text-center text-sm font-semibold text-destructive">{errorMessage}</p>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/heic,image/heif"
              className="hidden"
              onChange={handleInputChange}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/png,image/jpeg,image/heic,image/heif"
              capture="environment"
              className="hidden"
              onChange={handleInputChange}
            />
          </>
        )}

        {stage === "rotate" && rotatePreviewUrl && (
          <div className="flex flex-1 flex-col gap-6">
            <div className="flex flex-col gap-1 text-center">
              <h2 className="font-heading text-xl font-bold text-foreground">
                A imagem está na posição certa?
              </h2>
              <p className="text-sm text-muted-foreground">Gire se precisar antes de continuar</p>
            </div>

            <div className="flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={rotatePreviewUrl}
                alt="Pré-visualização"
                className="max-h-72 max-w-full object-contain transition-transform"
                style={{ transform: `rotate(${rotation}deg)` }}
              />
            </div>

            <div className="flex justify-center gap-4">
              <button
                type="button"
                aria-label="Girar para esquerda"
                onClick={() => setRotation(((rotation - 90 + 360) % 360) as RotationDegrees)}
                className="flex size-14 items-center justify-center rounded-full border border-border bg-card text-foreground"
              >
                <RotateCcw className="size-6" />
              </button>
              <button
                type="button"
                aria-label="Girar para direita"
                onClick={() => setRotation(((rotation + 90) % 360) as RotationDegrees)}
                className="flex size-14 items-center justify-center rounded-full border border-border bg-card text-foreground"
              >
                <RotateCw className="size-6" />
              </button>
            </div>

            <Button variant="default" size="xl" className="w-full" onClick={handleRotateConfirm}>
              Continuar
            </Button>
          </div>
        )}

        {stage === "processing" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <Loader2 className="size-10 animate-spin text-primary" />
            <p className="font-heading text-lg font-bold text-foreground">{processingLabel}</p>
          </div>
        )}

        {stage === "tagging" && (
          <div className="flex flex-1 flex-col gap-5">
            <div className="flex flex-col gap-1 text-center">
              <h2 className="font-heading text-xl font-bold text-foreground">O que tem no seu desenho?</h2>
              <p className="text-sm text-muted-foreground">Toque em cada forma e diga o que ela é</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {shapes.map((shape) => {
                const roleMeta = ROLE_OPTIONS.find((option) => option.value === shape.role);
                return (
                  <div key={shape.id} className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveShapeId(shape.id === activeShapeId ? null : shape.id)}
                      className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border-2 border-border bg-[conic-gradient(theme(colors.muted.DEFAULT)_0_25%,transparent_0_50%)] bg-[length:12px_12px]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shape.canvas.toDataURL()}
                        alt=""
                        className="size-full object-contain p-1"
                      />
                      <span className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-white text-sm shadow">
                        {roleMeta?.emoji}
                      </span>
                    </button>

                    {activeShapeId === shape.id && (
                      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1.5">
                        {ROLE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setShapeRole(shape.id, option.value)}
                            className={cn(
                              "flex size-7 items-center justify-center rounded-lg text-sm",
                              shape.role === option.value ? "bg-primary/15" : "hover:bg-muted",
                            )}
                            aria-label={option.label}
                          >
                            {option.emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <Button variant="default" size="xl" className="mt-auto w-full" onClick={handleTaggingContinue}>
              Continuar
            </Button>
          </div>
        )}

        {stage === "result" && originalUrl && resultUrl && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={originalUrl}
                  alt="Desenho original"
                  className="aspect-square w-full rounded-2xl border border-border object-cover"
                />
                <span className="text-xs font-semibold text-muted-foreground">Original</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resultUrl}
                  alt="Sprite sem fundo"
                  className="aspect-square w-full rounded-2xl border border-border bg-[conic-gradient(theme(colors.muted.DEFAULT)_0_25%,transparent_0_50%)] bg-[length:16px_16px] object-contain"
                />
                <span className="text-xs font-semibold text-muted-foreground">Resultado</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-success">
              <CheckCircle2 className="size-5" />
              <span className="font-semibold">Fundo removido</span>
            </div>

            <Button
              variant="default"
              size="xl"
              className="w-full"
              onClick={handleFinalContinue}
              disabled={isFinalizing}
            >
              {isFinalizing ? <Loader2 className="size-5 animate-spin" /> : "Continuar"}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
