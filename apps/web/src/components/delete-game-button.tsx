"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

import { deleteGame } from "@/lib/api";

export function DeleteGameButton({ gameId, gameName }: { gameId: string; gameName: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Excluir "${gameName}"? Essa ação não pode ser desfeita.`)) return;

    setIsDeleting(true);
    try {
      await deleteGame(gameId);
      router.refresh();
    } catch (error) {
      setIsDeleting(false);
      window.alert(error instanceof Error ? error.message : "Não foi possível excluir o jogo.");
    }
  }

  return (
    <button
      type="button"
      aria-label={`Excluir ${gameName}`}
      onClick={handleDelete}
      disabled={isDeleting}
      className="flex size-7 items-center justify-center rounded-full bg-white/90 text-muted-foreground shadow-sm transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
    >
      {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
    </button>
  );
}
