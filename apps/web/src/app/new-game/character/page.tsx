"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { WizardHeader } from "@/components/wizard-header";
import { listSprites, type SpriteSummary } from "@/lib/api";
import { PRESET_CHARACTERS } from "@/lib/preset-characters";
import { cn } from "@/lib/utils";

type Selection = {
  source: "DRAWING" | "PRESET";
  spriteUrl: string;
  originalUrl?: string;
  name: string;
  existingSpriteId?: string;
};

function CharacterScreenContent() {
  const searchParams = useSearchParams();
  const original = searchParams.get("original");
  const sprite = searchParams.get("sprite");

  const [selected, setSelected] = useState<Selection | null>(null);
  const [savedSprites, setSavedSprites] = useState<SpriteSummary[]>([]);

  useEffect(() => {
    listSprites().then(setSavedSprites);
  }, []);

  const myDrawingSelection: Selection | null = sprite
    ? { source: "DRAWING", spriteUrl: sprite, originalUrl: original ?? undefined, name: "Meu Desenho" }
    : null;

  function selectPreset(preset: (typeof PRESET_CHARACTERS)[number]) {
    setSelected({ source: "PRESET", spriteUrl: `preset:${preset.id}`, name: preset.label });
  }

  function selectSaved(savedSprite: SpriteSummary) {
    setSelected({
      source: "DRAWING",
      spriteUrl: savedSprite.spriteImageUrl,
      originalUrl: savedSprite.originalImageUrl ?? undefined,
      name: "Meu Personagem",
      existingSpriteId: savedSprite.id,
    });
  }

  const nextParams = selected
    ? new URLSearchParams({
        source: selected.source,
        spriteUrl: selected.spriteUrl,
        name: selected.name,
        ...(selected.originalUrl ? { originalUrl: selected.originalUrl } : {}),
        ...(selected.existingSpriteId ? { spriteId: selected.existingSpriteId } : {}),
      })
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <WizardHeader title="Novo Jogo" backHref="/new-game" currentStep={2} totalSteps={4} />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8 sm:px-6 animate-fade-in-up">
        <div className="flex flex-col gap-1 text-center">
          <h2 className="font-heading text-xl font-bold text-foreground">Escolha seu personagem</h2>
          <p className="text-sm text-muted-foreground">
            Use seu desenho ou escolha um personagem pronto
          </p>
        </div>

        {myDrawingSelection && (
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Meu Desenho
            </h3>
            <button
              type="button"
              onClick={() => setSelected(myDrawingSelection)}
              className={cn(
                "relative flex size-24 items-center justify-center overflow-hidden rounded-2xl border-2 bg-muted",
                selected?.source === "DRAWING" ? "border-primary" : "border-border",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sprite ?? undefined} alt="Meu desenho" className="size-full object-contain" />
              {selected?.source === "DRAWING" && (
                <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" />
                </span>
              )}
            </button>
          </section>
        )}

        {savedSprites.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Meus Personagens
            </h3>
            <div className="grid grid-cols-4 gap-3">
              {savedSprites.map((savedSprite) => {
                const isSelected = selected?.existingSpriteId === savedSprite.id;
                return (
                  <button
                    key={savedSprite.id}
                    type="button"
                    onClick={() => selectSaved(savedSprite)}
                    className={cn(
                      "relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border-2 bg-muted",
                      isSelected ? "border-primary" : "border-border",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={savedSprite.spriteImageUrl}
                      alt="Personagem salvo"
                      className="size-full object-contain"
                    />
                    {isSelected && (
                      <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Personagens
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {PRESET_CHARACTERS.map((preset) => {
              const isSelected =
                selected?.source === "PRESET" && selected.spriteUrl === `preset:${preset.id}`;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-label={preset.label}
                  onClick={() => selectPreset(preset)}
                  className={cn(
                    "relative flex aspect-square flex-col items-center justify-center rounded-2xl border-2 text-3xl transition-transform hover:-translate-y-0.5",
                    isSelected ? "border-primary" : "border-transparent",
                  )}
                  style={{ backgroundColor: preset.color }}
                >
                  {preset.emoji}
                  {isSelected && (
                    <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <Link
          href={nextParams ? `/new-game/generate?${nextParams.toString()}` : "#"}
          aria-disabled={!selected}
          tabIndex={selected ? undefined : -1}
          className={cn(
            buttonVariants({ variant: "default", size: "xl" }),
            "w-full",
            !selected && "pointer-events-none opacity-50",
          )}
        >
          Próximo
        </Link>
      </main>
    </div>
  );
}

export default function ChooseCharacterPage() {
  return (
    <Suspense>
      <CharacterScreenContent />
    </Suspense>
  );
}
