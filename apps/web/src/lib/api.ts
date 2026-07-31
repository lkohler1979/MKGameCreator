import type { ColorRoleEntry } from "@/lib/color-roles";
import type { SceneConfig } from "@/lib/scene-config-builder";

// No servidor (Server Components / rodando dentro do container do Next.js),
// "localhost" aponta para o próprio container, não para o backend — por isso
// usa o hostname interno do Docker (API_INTERNAL_URL). No browser, usa a porta
// mapeada no host (NEXT_PUBLIC_API_URL).
const API_URL =
  typeof window === "undefined"
    ? (process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333")
    : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333");

// Server Components fazem uma requisição HTTP nova e separada da do navegador
// - o cookie de sessão não é anexado automaticamente. Repassa o header Cookie
// cru da requisição original só no lado do servidor (no-op no navegador, que
// já manda o cookie sozinho via credentials:"include").
async function serverCookieHeader(): Promise<HeadersInit> {
  if (typeof window !== "undefined") return {};
  const { cookies } = await import("next/headers");
  return { cookie: (await cookies()).toString() };
}

export async function uploadImage(file: File | Blob, filename = "upload.png") {
  const formData = new FormData();
  formData.append("file", file, filename);

  const response = await fetch(`${API_URL}/uploads`, {
    method: "POST",
    body: formData,
    credentials: "include",
    headers: await serverCookieHeader(),
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
    headers: { "Content-Type": "application/json", ...(await serverCookieHeader()) },
    body: JSON.stringify(body),
    credentials: "include",
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error ?? `Falha na requisição para ${path}`);
  }

  return response.json() as Promise<T>;
}

export type CurrentUser = { id: string; email: string; name: string | null };

export function signup(input: { email: string; password: string; name?: string }) {
  return postJson<CurrentUser>("/auth/signup", input);
}

export function login(input: { email: string; password: string }) {
  return postJson<CurrentUser>("/auth/login", input);
}

export async function logout(): Promise<void> {
  await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: await serverCookieHeader(),
  });
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const response = await fetch(`${API_URL}/auth/me`, {
    credentials: "include",
    cache: "no-store",
    headers: await serverCookieHeader(),
  });
  if (!response.ok) return null;
  return response.json() as Promise<CurrentUser>;
}

export function createSprite(input: {
  source: "DRAWING" | "PRESET";
  originalImageUrl?: string;
  spriteImageUrl: string;
}) {
  return postJson<{ id: string }>("/sprites", input);
}

export type SpriteSummary = {
  id: string;
  source: "DRAWING" | "PRESET";
  spriteImageUrl: string;
  originalImageUrl: string | null;
  createdAt: string;
};

export async function listSprites(): Promise<SpriteSummary[]> {
  const response = await fetch(`${API_URL}/sprites`, {
    credentials: "include",
    cache: "no-store",
    headers: await serverCookieHeader(),
  });
  if (!response.ok) return [];
  return response.json() as Promise<SpriteSummary[]>;
}

export function createGame(input: {
  spriteId: string;
  name: string;
  sceneConfig?: SceneConfig;
  templateType?: "PLATFORM" | "MAZE" | "COLLECT" | "BRICK_BREAKER" | "RACE" | "AIR_HOCKEY";
}) {
  return postJson<{ id: string; shareSlug: string }>("/games", input);
}

export type GameVisibility = "PRIVATE" | "PUBLIC";
export type LibraryTab = "all" | "public" | "private" | "favorites";

export type GameSummary = {
  id: string;
  name: string;
  createdAt: string;
  spriteImageUrl: string;
  visibility: GameVisibility;
  isFavorite: boolean;
};

export async function listGames(tab: LibraryTab = "all"): Promise<GameSummary[]> {
  const response = await fetch(`${API_URL}/games?tab=${tab}`, {
    cache: "no-store",
    credentials: "include",
    headers: await serverCookieHeader(),
  });
  if (!response.ok) return [];
  return response.json() as Promise<GameSummary[]>;
}

export async function updateGameVisibility(id: string, visibility: GameVisibility): Promise<void> {
  const response = await fetch(`${API_URL}/games/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(await serverCookieHeader()) },
    body: JSON.stringify({ visibility }),
    credentials: "include",
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error ?? "Não foi possível atualizar a visibilidade.");
  }
}

export async function updateGameScene(id: string, sceneConfig: SceneConfig): Promise<void> {
  const response = await fetch(`${API_URL}/games/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(await serverCookieHeader()) },
    body: JSON.stringify({ sceneConfig }),
    credentials: "include",
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error ?? "Não foi possível salvar o cenário.");
  }
}

export async function setGameFavorite(id: string, isFavorite: boolean): Promise<void> {
  const response = await fetch(`${API_URL}/games/${id}/favorite`, {
    method: isFavorite ? "POST" : "DELETE",
    credentials: "include",
    headers: await serverCookieHeader(),
  });
  if (!response.ok) {
    throw new Error("Não foi possível atualizar o favorito.");
  }
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
  const response = await fetch(`${API_URL}/games/${id}`, {
    cache: "no-store",
    credentials: "include",
    headers: await serverCookieHeader(),
  });
  if (!response.ok) throw new Error("Jogo não encontrado");
  return response.json() as Promise<GameDetail>;
}

export type RankingEntry = {
  id: string;
  playerName: string;
  coinsCollected: number;
  timeSeconds: number | null;
  finishedAt: string | null;
};

export async function getGameRanking(gameId: string): Promise<RankingEntry[]> {
  const response = await fetch(`${API_URL}/games/${gameId}/ranking`, {
    cache: "no-store",
    credentials: "include",
    headers: await serverCookieHeader(),
  });
  if (!response.ok) return [];
  return response.json() as Promise<RankingEntry[]>;
}

export function createGameSession(
  gameId: string,
  input: { completed: boolean; timeSeconds: number; coinsCollected: number; livesRemaining: number },
) {
  return postJson<{ id: string }>(`/games/${gameId}/sessions`, input);
}

export type CommunityGame = {
  id: string;
  name: string;
  createdAt: string;
  spriteImageUrl: string;
  authorName: string;
  likesCount: number;
  isLiked: boolean;
};

export async function listCommunityGames(): Promise<CommunityGame[]> {
  const response = await fetch(`${API_URL}/games/community`, {
    cache: "no-store",
    credentials: "include",
    headers: await serverCookieHeader(),
  });
  if (!response.ok) return [];
  return response.json() as Promise<CommunityGame[]>;
}

export async function reportGame(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/games/${id}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await serverCookieHeader()) },
    body: JSON.stringify({}),
    credentials: "include",
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error ?? "Não foi possível enviar a denúncia.");
  }
}

export async function getColorConfig(): Promise<ColorRoleEntry[] | null> {
  const response = await fetch(`${API_URL}/color-config`, {
    cache: "no-store",
    credentials: "include",
    headers: await serverCookieHeader(),
  });
  if (!response.ok) return null;
  const { entries } = (await response.json()) as { entries: ColorRoleEntry[] | null };
  return entries;
}

export async function updateColorConfig(entries: ColorRoleEntry[]): Promise<void> {
  const response = await fetch(`${API_URL}/color-config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(await serverCookieHeader()) },
    body: JSON.stringify({ entries }),
    credentials: "include",
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error ?? "Não foi possível salvar a configuração de cores.");
  }
}

export async function deleteGame(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/games/${id}`, {
    method: "DELETE",
    credentials: "include",
    headers: await serverCookieHeader(),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error ?? "Não foi possível excluir o jogo.");
  }
}
