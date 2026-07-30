"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";

import { setGameFavorite } from "@/lib/api";

export function FavoriteButton({ gameId, isFavorite }: { gameId: string; isFavorite: boolean }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  async function handleToggle() {
    setIsSaving(true);
    try {
      await setGameFavorite(gameId, !isFavorite);
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Não foi possível atualizar o favorito.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <button
      type="button"
      aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      onClick={handleToggle}
      disabled={isSaving}
      className="flex size-7 items-center justify-center rounded-full bg-white/90 text-muted-foreground shadow-sm transition-colors hover:text-cta disabled:opacity-50"
    >
      <Heart className="size-3.5" fill={isFavorite ? "#FFC736" : "transparent"} stroke="currentColor" />
    </button>
  );
}
