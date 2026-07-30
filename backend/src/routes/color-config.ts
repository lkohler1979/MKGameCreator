import type { FastifyInstance } from "fastify";

import { requireAuth } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";

// Espelha ElementRole de apps/web/src/lib/element-roles.ts, exceto
// "personagem" - o personagem é sempre a maior forma detectada, nunca
// decidido por cor, então não faz sentido configurável aqui.
const VALID_ROLES = new Set([
  "moeda",
  "pular",
  "machuca",
  "powerup",
  "inimigo",
  "destrutivel",
  "dinamico",
  "ignorar",
]);

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

function isValidEntries(value: unknown): value is { color: string; role: string }[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      typeof (entry as { color?: unknown }).color === "string" &&
      HEX_COLOR_RE.test((entry as { color: string }).color) &&
      VALID_ROLES.has((entry as { role?: unknown }).role as string),
  );
}

export async function registerColorConfigRoutes(app: FastifyInstance) {
  app.get("/color-config", { preHandler: requireAuth }, async (request) => {
    return { entries: request.user!.colorRoleMap ?? null };
  });

  app.put("/color-config", { preHandler: requireAuth }, async (request, reply) => {
    const body = request.body as { entries?: unknown };

    if (!isValidEntries(body?.entries)) {
      return reply.code(400).send({ error: "entries inválido — cada item precisa de color (#rrggbb) e role válido" });
    }

    await prisma.user.update({
      where: { id: request.user!.id },
      data: { colorRoleMap: body.entries },
    });

    return reply.code(204).send();
  });
}
