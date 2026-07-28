import Link from "next/link";
import { ChevronRight, Gamepad2, Play, Plus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { DeleteGameButton } from "@/components/delete-game-button";
import { listGames } from "@/lib/api";
import { PRESET_CHARACTERS } from "@/lib/preset-characters";

function GameThumbnail({ spriteImageUrl }: { spriteImageUrl: string }) {
  if (spriteImageUrl.startsWith("preset:")) {
    const presetId = spriteImageUrl.slice("preset:".length);
    const preset = PRESET_CHARACTERS.find((item) => item.id === presetId);
    return (
      <div
        className="flex aspect-video w-full items-center justify-center rounded-xl text-4xl"
        style={{ backgroundColor: preset?.color ?? "#EEEEEE" }}
      >
        {preset?.emoji ?? "🎮"}
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={spriteImageUrl} alt="" className="aspect-video w-full rounded-xl object-cover" />;
}

export default async function HomePage() {
  const games = await listGames();

  return (
    <AppShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-6 sm:px-6 animate-fade-in-up">
        <Link
          href="/new-game"
          className="flex items-center gap-4 rounded-2xl bg-primary px-5 py-4 text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/15">
            <Plus className="size-6" />
          </span>
          <span className="flex flex-col text-left">
            <span className="font-heading text-lg font-extrabold tracking-wide">
              NOVO JOGO
            </span>
            <span className="text-sm font-medium text-primary-foreground/80">
              Criar um jogo do zero
            </span>
          </span>
        </Link>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-sm font-bold tracking-wide text-muted-foreground">
              MEUS JOGOS
            </h2>
            <span className="flex items-center gap-0.5 text-sm font-semibold text-muted-foreground">
              Ver todos
              <ChevronRight className="size-4" />
            </span>
          </div>

          {games.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border py-14 text-center">
              <Gamepad2 className="size-10 text-muted-foreground/50" />
              <p className="font-heading text-base font-bold text-foreground">
                Nenhum jogo ainda
              </p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Crie seu primeiro jogo a partir de um desenho!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {games.map((game) => (
                <div key={game.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3">
                  <div className="relative">
                    <GameThumbnail spriteImageUrl={game.spriteImageUrl} />
                    <div className="absolute right-1 top-1">
                      <DeleteGameButton gameId={game.id} gameName={game.name} />
                    </div>
                  </div>
                  <p className="truncate font-heading text-sm font-bold text-foreground">
                    {game.name}
                  </p>
                  <Link
                    href={`/play/${game.id}`}
                    className="flex items-center justify-center gap-1.5 rounded-full bg-primary py-1.5 text-xs font-bold text-primary-foreground"
                  >
                    <Play className="size-3" />
                    Jogar
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
