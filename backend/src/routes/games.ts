import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";

import { getOrCreateDevUser } from "../lib/dev-user.js";
import { prisma } from "../lib/prisma.js";

const SPRITE_SOURCES = new Set(["DRAWING", "PRESET"]);
const GAME_TEMPLATES = new Set(["PLATFORM", "MAZE"]);

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
  app.post("/sprites", async (request, reply) => {
    const body = request.body as {
      source?: string;
      originalImageUrl?: string;
      spriteImageUrl?: string;
    };

    if (!body?.spriteImageUrl || !body.source || !SPRITE_SOURCES.has(body.source)) {
      return reply.code(400).send({ error: "spriteImageUrl e source (DRAWING|PRESET) são obrigatórios" });
    }

    const devUser = await getOrCreateDevUser();

    const sprite = await prisma.sprite.create({
      data: {
        userId: devUser.id,
        source: body.source as "DRAWING" | "PRESET",
        originalImageUrl: body.originalImageUrl ?? null,
        spriteImageUrl: body.spriteImageUrl,
      },
    });

    return sprite;
  });

  app.post("/games", async (request, reply) => {
    const body = request.body as {
      spriteId?: string;
      name?: string;
      sceneConfig?: unknown;
      templateType?: string;
    };

    if (!body?.spriteId) {
      return reply.code(400).send({ error: "spriteId é obrigatório" });
    }

    const devUser = await getOrCreateDevUser();
    const sceneConfig = isValidSceneConfig(body.sceneConfig) ? body.sceneConfig : DEFAULT_SCENE_CONFIG;
    const templateType = GAME_TEMPLATES.has(body.templateType ?? "") ? body.templateType : "PLATFORM";

    try {
      const game = await prisma.game.create({
        data: {
          userId: devUser.id,
          spriteId: body.spriteId,
          name: body.name?.trim() || "Meu Jogo",
          templateType: templateType as "PLATFORM" | "MAZE",
          sceneConfig: sceneConfig as Prisma.InputJsonValue,
        },
      });

      return { id: game.id, shareSlug: game.shareSlug };
    } catch {
      return reply.code(400).send({ error: "Não foi possível criar o jogo (spriteId inválido?)" });
    }
  });

  app.get("/games/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const devUser = await getOrCreateDevUser();

    const game = await prisma.game.findFirst({
      where: { id, userId: devUser.id },
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

  app.post("/games/:id/sessions", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      completed?: boolean;
      timeSeconds?: number;
      coinsCollected?: number;
      livesRemaining?: number;
    };

    const devUser = await getOrCreateDevUser();

    const game = await prisma.game.findFirst({ where: { id, userId: devUser.id } });
    if (!game) {
      return reply.code(404).send({ error: "Jogo não encontrado" });
    }

    const session = await prisma.gameSession.create({
      data: {
        gameId: id,
        userId: devUser.id,
        completed: body.completed ?? false,
        timeSeconds: body.timeSeconds,
        coinsCollected: body.coinsCollected ?? 0,
        livesRemaining: body.livesRemaining,
        finishedAt: new Date(),
      },
    });

    return { id: session.id };
  });

  app.delete("/games/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const devUser = await getOrCreateDevUser();

    const game = await prisma.game.findFirst({ where: { id, userId: devUser.id } });
    if (!game) {
      return reply.code(404).send({ error: "Jogo não encontrado" });
    }

    await prisma.game.delete({ where: { id } });
    return reply.code(204).send();
  });

  app.get("/games", async () => {
    const devUser = await getOrCreateDevUser();

    const games = await prisma.game.findMany({
      where: { userId: devUser.id },
      orderBy: { createdAt: "desc" },
      include: { sprite: true },
    });

    return games.map((game) => ({
      id: game.id,
      name: game.name,
      createdAt: game.createdAt,
      spriteImageUrl: game.sprite.spriteImageUrl,
    }));
  });
}
