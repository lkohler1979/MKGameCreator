import type { SceneConfig } from "@/lib/scene-config-builder";

// No servidor (Server Components / rodando dentro do container do Next.js),
// "localhost" aponta para o próprio container, não para o backend — por isso
// usa o hostname interno do Docker (API_INTERNAL_URL). No browser, usa a porta
// mapeada no host (NEXT_PUBLIC_API_URL).
const API_URL =
  typeof window === "undefined"
    ? (process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333")
    : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333");

export async function uploadImage(file: File | Blob, filename = "upload.png") {
  const formData = new FormData();
  formData.append("file", file, filename);

  const response = await fetch(`${API_URL}/uploads`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? "Falha ao enviar a imagem");
  }

  const { url } = (await response.json()) as { url: string };
  return `${API_URL}${url}`;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error ?? `Falha na requisição para ${path}`);
  }

  return response.json() as Promise<T>;
}

export function createSprite(input: {
  source: "DRAWING" | "PRESET";
  originalImageUrl?: string;
  spriteImageUrl: string;
}) {
  return postJson<{ id: string }>("/sprites", input);
}

export function createGame(input: {
  spriteId: string;
  name: string;
  sceneConfig?: SceneConfig;
  templateType?: "PLATFORM" | "MAZE";
}) {
  return postJson<{ id: string; shareSlug: string }>("/games", input);
}

export type GameSummary = {
  id: string;
  name: string;
  createdAt: string;
  spriteImageUrl: string;
};

export async function listGames(): Promise<GameSummary[]> {
  const response = await fetch(`${API_URL}/games`, { cache: "no-store" });
  if (!response.ok) return [];
  return response.json() as Promise<GameSummary[]>;
}

export type GameDetail = {
  id: string;
  name: string;
  templateType: string;
  sceneConfig: SceneConfig;
  sprite: {
    source: "DRAWING" | "PRESET";
    spriteImageUrl: string;
    originalImageUrl: string | null;
  };
};

export async function getGame(id: string): Promise<GameDetail> {
  const response = await fetch(`${API_URL}/games/${id}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Jogo não encontrado");
  return response.json() as Promise<GameDetail>;
}

export function createGameSession(
  gameId: string,
  input: { completed: boolean; timeSeconds: number; coinsCollected: number; livesRemaining: number },
) {
  return postJson<{ id: string }>(`/games/${gameId}/sessions`, input);
}

export async function deleteGame(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/games/${id}`, { method: "DELETE" });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error ?? "Não foi possível excluir o jogo.");
  }
}
