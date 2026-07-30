import Link from "next/link";
import { Globe, Heart, Play } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { FavoriteButton } from "@/components/favorite-button";
import { GameThumbnail } from "@/components/game-thumbnail";
import { ReportButton } from "@/components/report-button";
import { listCommunityGames } from "@/lib/api";

export default async function ComunidadePage() {
  const games = await listCommunityGames();

  return (
    <AppShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 animate-fade-in-up">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-xl font-bold text-foreground">Comunidade</h1>
          <p className="text-sm text-muted-foreground">Jogos públicos criados por outros jogadores.</p>
        </div>

        {games.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border py-14 text-center">
            <Globe className="size-10 text-muted-foreground/50" />
            <p className="font-heading text-base font-bold text-foreground">Nenhum jogo público ainda</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Torne um dos seus jogos público na Home pra ser o primeiro a aparecer aqui.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {games.map((game) => (
              <div key={game.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3">
                <div className="relative">
                  <GameThumbnail spriteImageUrl={game.spriteImageUrl} />
                  <div className="absolute right-1 top-1 flex gap-1">
                    <FavoriteButton gameId={game.id} isFavorite={game.isLiked} />
                    <ReportButton gameId={game.id} gameName={game.name} />
                  </div>
                </div>
                <p className="truncate font-heading text-sm font-bold text-foreground">{game.name}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate">por {game.authorName}</span>
                  <span className="flex shrink-0 items-center gap-0.5">
                    <Heart className="size-3" />
                    {game.likesCount}
                  </span>
                </div>
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
      </div>
    </AppShell>
  );
}
