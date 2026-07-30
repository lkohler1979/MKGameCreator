"use client";

import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";

import { reportGame } from "@/lib/api";

export function ReportButton({ gameId, gameName }: { gameId: string; gameName: string }) {
  const [isReporting, setIsReporting] = useState(false);
  const [reported, setReported] = useState(false);

  async function handleReport() {
    if (!window.confirm(`Denunciar "${gameName}"? Nossa equipe vai revisar o conteúdo.`)) return;

    setIsReporting(true);
    try {
      await reportGame(gameId);
      setReported(true);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Não foi possível enviar a denúncia.");
    } finally {
      setIsReporting(false);
    }
  }

  return (
    <button
      type="button"
      aria-label={`Denunciar ${gameName}`}
      onClick={handleReport}
      disabled={isReporting || reported}
      className="flex size-7 items-center justify-center rounded-full bg-white/90 text-muted-foreground shadow-sm transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
    >
      {isReporting ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Flag className="size-3.5" fill={reported ? "currentColor" : "transparent"} />
      )}
    </button>
  );
}
