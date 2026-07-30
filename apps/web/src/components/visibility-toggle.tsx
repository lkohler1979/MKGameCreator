"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe2, Lock } from "lucide-react";

import { updateGameVisibility, type GameVisibility } from "@/lib/api";

export function VisibilityToggle({ gameId, visibility }: { gameId: string; visibility: GameVisibility }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const isPublic = visibility === "PUBLIC";

  async function handleToggle() {
    setIsSaving(true);
    try {
      await updateGameVisibility(gameId, isPublic ? "PRIVATE" : "PUBLIC");
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Não foi possível atualizar a visibilidade.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isSaving}
      className="flex items-center gap-1 self-start rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-muted/70 disabled:opacity-50"
    >
      {isPublic ? <Globe2 className="size-3" /> : <Lock className="size-3" />}
      {isPublic ? "Público" : "Privado"}
    </button>
  );
}
