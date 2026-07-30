"use client";

import { useEffect } from "react";

// Depois de cada novo deploy, o build gera hashes de chunk diferentes. Uma
// aba que já estava aberta antes do deploy ainda referencia os hashes
// antigos, e a navegação client-side (ex. "Começar" na Splash) falha ao
// buscar um chunk que não existe mais no servidor. Aqui recarregamos a
// página uma única vez para pegar o HTML/JS atual, em vez de deixar a
// navegação simplesmente travar com um erro no console.
const RELOAD_FLAG = "mkgc_chunk_reload";
const STABLE_AFTER_MS = 5000;

function isChunkLoadError(reason: unknown): boolean {
  if (!reason || typeof reason !== "object") return false;
  const err = reason as { name?: string; message?: string };
  const message = err.message ?? "";
  return (
    err.name === "ChunkLoadError" ||
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message)
  );
}

export function ChunkReloadGuard() {
  useEffect(() => {
    const reloadOnce = () => {
      if (sessionStorage.getItem(RELOAD_FLAG)) return;
      sessionStorage.setItem(RELOAD_FLAG, "1");
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error)) reloadOnce();
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) reloadOnce();
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    // Se a página ficar estável por alguns segundos, limpa a flag: um
    // próximo deploy futuro deve continuar disparando um novo reload.
    const clearTimer = window.setTimeout(() => {
      sessionStorage.removeItem(RELOAD_FLAG);
    }, STABLE_AFTER_MS);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.clearTimeout(clearTimer);
    };
  }, []);

  return null;
}
