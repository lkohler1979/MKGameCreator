import Link from "next/link";
import { ChevronRight, Gamepad2, Globe, Palette, Play, Plus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { DeleteGameButton } from "@/components/delete-game-button";
import { FavoriteButton } from "@/components/favorite-button";
import { GameThumbnail } from "@/components/game-thumbnail";
import { VisibilityToggle } from "@/components/visibility-toggle";
import { listGames, type LibraryTab } from "@/lib/api";
import { cn } from "@/lib/utils";

const TABS: { value: LibraryTab; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "public", label: "Públicos" },
  { value: "private", label: "Privados" },
  { value: "favorites", label: "Favoritos" },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: rawTab } = await searchParams;
  const activeTab = TABS.some((t) => t.value === rawTab) ? (rawTab as LibraryTab) : "all";
  const games = await listGames(activeTab);

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

        <Link
          href="/comunidade"
          className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary">
            <Globe className="size-4" />
          </span>
          <span className="flex flex-col text-left">
            <span className="font-heading text-sm font-bold text-foreground">Comunidade</span>
            <span className="text-xs text-muted-foreground">Ver jogos públicos de outros jogadores</span>
          </span>
        </Link>

        <Link
          href="/configuracoes/cores"
          className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary">
            <Palette className="size-4" />
          </span>
          <span className="flex flex-col text-left">
            <span className="font-heading text-sm font-bold text-foreground">Cores e Categorias</span>
            <span className="text-xs text-muted-foreground">Configure o que cada cor do desenho significa</span>
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

          <div className="flex gap-2 overflow-x-auto">
            {TABS.map((t) => (
              <Link
                key={t.value}
                href={t.value === "all" ? "/home" : `/home?tab=${t.value}`}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  activeTab === t.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                {t.label}
              </Link>
            ))}
          </div>

          {games.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border py-14 text-center">
              <Gamepad2 className="size-10 text-muted-foreground/50" />
              <p className="font-heading text-base font-bold text-foreground">
                {activeTab === "all" ? "Nenhum jogo ainda" : "Nada por aqui ainda"}
              </p>
              <p className="max-w-xs text-sm text-muted-foreground">
                {activeTab === "all"
                  ? "Crie seu primeiro jogo a partir de um desenho!"
                  : "Os jogos que combinarem com esse filtro aparecem aqui."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {games.map((game) => (
                <div key={game.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3">
                  <div className="relative">
                    <GameThumbnail spriteImageUrl={game.spriteImageUrl} />
                    <div className="absolute right-1 top-1 flex gap-1">
                      <FavoriteButton gameId={game.id} isFavorite={game.isFavorite} />
                      <DeleteGameButton gameId={game.id} gameName={game.name} />
                    </div>
                  </div>
                  <p className="truncate font-heading text-sm font-bold text-foreground">
                    {game.name}
                  </p>
                  <VisibilityToggle gameId={game.id} visibility={game.visibility} />
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
