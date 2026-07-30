import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";

import { optionalAuth, requireAuth } from "../lib/auth.js";
import { containsBannedWords } from "../lib/content-filter.js";
import { prisma } from "../lib/prisma.js";

const SPRITE_SOURCES = new Set(["DRAWING", "PRESET"]);
const GAME_TEMPLATES = new Set(["PLATFORM", "MAZE", "COLLECT"]);
const GAME_VISIBILITIES = new Set(["PRIVATE", "PUBLIC"]);
const LIBRARY_TABS = new Set(["all", "public", "private", "favorites"]);

// TODO(sprint-4): motor de jogo vai consumir/renderizar esse layout. Por ora é
// um cenário fixo do template "Plataforma" (sem geração procedural real).
const DEFAULT_SCENE_CONFIG = {
  groundY: 500,
  coins: [
    { x: 300, y: 420 },
    { x: 450, y: 380 },
    { x: 600, y: 420 },
    { x: 750, y: 350 },
  ],
  obstacles: [{ type: "hazard", x: 520, y: 470 }],
  powerups: [{ x: 650, y: 400, type: "shield" }],
  flag: { x: 900, y: 420 },
};

function isValidSceneConfig(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const config = value as Record<string, unknown>;
  return (
    typeof config.groundY === "number" &&
    Array.isArray(config.coins) &&
    Array.isArray(config.obstacles) &&
    typeof config.flag === "object" &&
    config.flag !== null
  );
}

export async function registerGameRoutes(app: FastifyInstance) {
  app.post("/sprites", { preHandler: requireAuth }, async (request, reply) => {
    const body = request.body as {
      source?: string;
      originalImageUrl?: string;
      spriteImageUrl?: string;
    };

    if (!body?.spriteImageUrl || !body.source || !SPRITE_SOURCES.has(body.source)) {
      return reply.code(400).send({ error: "spriteImageUrl e source (DRAWING|PRESET) são obrigatórios" });
    }

    const sprite = await prisma.sprite.create({
      data: {
        userId: request.user!.id,
        source: body.source as "DRAWING" | "PRESET",
        originalImageUrl: body.originalImageUrl ?? null,
        spriteImageUrl: body.spriteImageUrl,
      },
    });

    return sprite;
  });

  app.get("/sprites", { preHandler: requireAuth }, async (request) => {
    const sprites = await prisma.sprite.findMany({
      where: { userId: request.user!.id, source: "DRAWING" },
      orderBy: { createdAt: "desc" },
      select: { id: true, source: true, spriteImageUrl: true, originalImageUrl: true, createdAt: true },
    });

    return sprites;
  });

  app.post("/games", { preHandler: requireAuth }, async (request, reply) => {
    const body = request.body as {
      spriteId?: string;
      name?: string;
      sceneConfig?: unknown;
      templateType?: string;
    };

    if (!body?.spriteId) {
      return reply.code(400).send({ error: "spriteId é obrigatório" });
    }

    const name = body.name?.trim() || "Meu Jogo";
    if (containsBannedWords(name)) {
      return reply.code(400).send({ error: "Esse nome não é permitido, tente outro" });
    }

    const sceneConfig = isValidSceneConfig(body.sceneConfig) ? body.sceneConfig : DEFAULT_SCENE_CONFIG;
    const templateType = GAME_TEMPLATES.has(body.templateType ?? "") ? body.templateType : "PLATFORM";

    try {
      const game = await prisma.game.create({
        data: {
          userId: request.user!.id,
          spriteId: body.spriteId,
          name,
          templateType: templateType as "PLATFORM" | "MAZE" | "COLLECT",
          sceneConfig: sceneConfig as Prisma.InputJsonValue,
        },
      });

      return { id: game.id, shareSlug: game.shareSlug };
    } catch {
      return reply.code(400).send({ error: "Não foi possível criar o jogo (spriteId inválido?)" });
    }
  });

  // Pública de propósito: sustenta o link de "Compartilhar" da tela Jogar -
  // qualquer pessoa com o id (não enumerável) pode abrir e jogar, sem conta.
  app.get("/games/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const game = await prisma.game.findUnique({
      where: { id },
      include: { sprite: true },
    });

    if (!game) {
      return reply.code(404).send({ error: "Jogo não encontrado" });
    }

    return {
      id: game.id,
      name: game.name,
      templateType: game.templateType,
      sceneConfig: game.sceneConfig,
      sprite: {
        source: game.sprite.source,
        spriteImageUrl: game.sprite.spriteImageUrl,
        originalImageUrl: game.sprite.originalImageUrl,
      },
    };
  });

  // Pública pelo mesmo motivo do GET /games/:id - o ranking de um jogo
  // compartilhado precisa ser visível pra quem recebeu o link, sem conta.
  app.get("/games/:id/ranking", async (request, reply) => {
    const { id } = request.params as { id: string };

    const game = await prisma.game.findUnique({ where: { id } });
    if (!game) {
      return reply.code(404).send({ error: "Jogo não encontrado" });
    }

    const sessions = await prisma.gameSession.findMany({
      where: { gameId: id, completed: true },
      orderBy: [{ coinsCollected: "desc" }, { timeSeconds: "asc" }],
      take: 10,
      include: { user: true },
    });

    return sessions.map((session) => ({
      id: session.id,
      playerName: session.user?.name ?? session.user?.email ?? "Anônimo",
      coinsCollected: session.coinsCollected,
      timeSeconds: session.timeSeconds,
      finishedAt: session.finishedAt,
    }));
  });

  // Pública (optionalAuth) pelo mesmo motivo do GET acima - um amigo sem
  // conta pode jogar um jogo compartilhado e registrar o resultado. Se
  // estiver logado, a sessão fica associada a ele; senão, fica anônima
  // (userId nulo) - nunca é carimbada com o dono do jogo, que não é quem jogou.
  app.post("/games/:id/sessions", { preHandler: optionalAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      completed?: boolean;
      timeSeconds?: number;
      coinsCollected?: number;
      livesRemaining?: number;
    };

    const game = await prisma.game.findUnique({ where: { id } });
    if (!game) {
      return reply.code(404).send({ error: "Jogo não encontrado" });
    }

    const session = await prisma.gameSession.create({
      data: {
        gameId: id,
        userId: request.user?.id ?? null,
        completed: body.completed ?? false,
        timeSeconds: body.timeSeconds,
        coinsCollected: body.coinsCollected ?? 0,
        livesRemaining: body.livesRemaining,
        finishedAt: new Date(),
      },
    });

    return { id: session.id };
  });

  // Sem checar dono do jogo - qualquer usuário pode denunciar. Sem fila de
  // aprovação/admin UI nesta rodada (Fase 4.7 mínima); fica persistido pra
  // revisão manual futura.
  app.post("/games/:id/report", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { reason?: string };

    const game = await prisma.game.findUnique({ where: { id } });
    if (!game) {
      return reply.code(404).send({ error: "Jogo não encontrado" });
    }

    await prisma.gameReport.create({
      data: { gameId: id, reporterId: request.user!.id, reason: body?.reason?.trim() || null },
    });

    return reply.code(204).send();
  });

  app.delete("/games/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const game = await prisma.game.findFirst({ where: { id, userId: request.user!.id } });
    if (!game) {
      return reply.code(404).send({ error: "Jogo não encontrado" });
    }

    await prisma.game.delete({ where: { id } });
    return reply.code(204).send();
  });

  app.patch("/games/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { visibility?: string; sceneConfig?: unknown };

    if (body?.visibility !== undefined && !GAME_VISIBILITIES.has(body.visibility)) {
      return reply.code(400).send({ error: "visibility (PRIVATE|PUBLIC) é obrigatório" });
    }
    if (body?.sceneConfig !== undefined && !isValidSceneConfig(body.sceneConfig)) {
      return reply.code(400).send({ error: "sceneConfig inválido" });
    }
    if (body?.visibility === undefined && body?.sceneConfig === undefined) {
      return reply.code(400).send({ error: "visibility ou sceneConfig é obrigatório" });
    }

    const game = await prisma.game.findFirst({ where: { id, userId: request.user!.id } });
    if (!game) {
      return reply.code(404).send({ error: "Jogo não encontrado" });
    }

    const updated = await prisma.game.update({
      where: { id },
      data: {
        ...(body.visibility !== undefined ? { visibility: body.visibility as "PRIVATE" | "PUBLIC" } : {}),
        ...(body.sceneConfig !== undefined ? { sceneConfig: body.sceneConfig as Prisma.InputJsonValue } : {}),
      },
    });

    return { id: updated.id, visibility: updated.visibility };
  });

  app.post("/games/:id/favorite", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const game = await prisma.game.findUnique({ where: { id } });
    if (!game) {
      return reply.code(404).send({ error: "Jogo não encontrado" });
    }

    await prisma.favorite.upsert({
      where: { userId_gameId: { userId: request.user!.id, gameId: id } },
      update: {},
      create: { userId: request.user!.id, gameId: id },
    });

    return reply.code(204).send();
  });

  app.delete("/games/:id/favorite", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };

    await prisma.favorite.deleteMany({ where: { userId: request.user!.id, gameId: id } });
    return reply.code(204).send();
  });

  app.get("/games", { preHandler: requireAuth }, async (request) => {
    const query = request.query as { tab?: string };
    const tab = LIBRARY_TABS.has(query.tab ?? "") ? query.tab! : "all";
    const userId = request.user!.id;

    const games =
      tab === "favorites"
        ? await prisma.game.findMany({
            where: { favorites: { some: { userId } } },
            orderBy: { createdAt: "desc" },
            include: { sprite: true, favorites: { where: { userId } } },
          })
        : await prisma.game.findMany({
            where: {
              userId,
              ...(tab === "public" ? { visibility: "PUBLIC" as const } : {}),
              ...(tab === "private" ? { visibility: "PRIVATE" as const } : {}),
            },
            orderBy: { createdAt: "desc" },
            include: { sprite: true, favorites: { where: { userId } } },
          });

    return games.map((game) => ({
      id: game.id,
      name: game.name,
      createdAt: game.createdAt,
      spriteImageUrl: game.sprite.spriteImageUrl,
      visibility: game.visibility,
      isFavorite: game.favorites.length > 0,
    }));
  });

  // Diferente de GET /games (sempre filtrado pelo dono) - lista jogos
  // públicos de QUALQUER usuário, pra tela de descoberta da Comunidade.
  app.get("/games/community", { preHandler: requireAuth }, async (request) => {
    const userId = request.user!.id;

    const games = await prisma.game.findMany({
      where: { visibility: "PUBLIC" },
      orderBy: { createdAt: "desc" },
      take: 60,
      include: { sprite: true, favorites: true, user: true },
    });

    return games.map((game) => ({
      id: game.id,
      name: game.name,
      createdAt: game.createdAt,
      spriteImageUrl: game.sprite.spriteImageUrl,
      authorName: game.user.name ?? game.user.email,
      likesCount: game.favorites.length,
      isLiked: game.favorites.some((favorite) => favorite.userId === userId),
    }));
  });
}
