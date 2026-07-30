import type { User } from "@prisma/client";
import type { FastifyReply, FastifyRequest } from "fastify";

import { prisma } from "./prisma.js";

export const SESSION_COOKIE_NAME = "mkgc_session";
export const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 dias

declare module "fastify" {
  interface FastifyRequest {
    user?: User;
  }
}

async function loadUserFromCookie(request: FastifyRequest): Promise<User | undefined> {
  const token = request.cookies[SESSION_COOKIE_NAME];
  if (!token) return undefined;

  const session = await prisma.authSession.findUnique({
    where: { id: token },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) return undefined;
  return session.user;
}

// Bloqueia a rota se não houver sessão válida — usado em tudo que cria/lista/
// apaga dados do próprio usuário.
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const user = await loadUserFromCookie(request);
  if (!user) {
    return reply.code(401).send({ error: "Não autenticado" });
  }
  request.user = user;
}

// Nunca bloqueia — só popula request.user se a sessão for válida. Usado em
// rotas públicas que se comportam diferente quando o visitante está logado
// (ex.: registrar quem jogou um jogo compartilhado, sem exigir conta).
export async function optionalAuth(request: FastifyRequest) {
  request.user = await loadUserFromCookie(request);
}
