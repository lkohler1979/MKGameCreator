import type { FastifyInstance } from "fastify";

import { requireAuth, SESSION_COOKIE_NAME, SESSION_DURATION_MS } from "../lib/auth.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function setSessionCookie(reply: import("fastify").FastifyReply, sessionId: string) {
  reply.setCookie(SESSION_COOKIE_NAME, sessionId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    domain: process.env.COOKIE_DOMAIN || undefined,
    maxAge: SESSION_DURATION_MS / 1000,
  });
}

async function createSession(userId: string) {
  return prisma.authSession.create({
    data: { userId, expiresAt: new Date(Date.now() + SESSION_DURATION_MS) },
  });
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post(
    "/auth/signup",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = request.body as { email?: string; password?: string; name?: string };

      if (!body?.email || !EMAIL_RE.test(body.email)) {
        return reply.code(400).send({ error: "E-mail inválido" });
      }
      if (!body.password || body.password.length < MIN_PASSWORD_LENGTH) {
        return reply.code(400).send({ error: `A senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres` });
      }

      const email = normalizeEmail(body.email);
      const passwordHash = await hashPassword(body.password);

      let user;
      try {
        user = await prisma.user.create({
          data: { email, name: body.name?.trim() || null, provider: "EMAIL", passwordHash },
        });
      } catch {
        return reply.code(400).send({ error: "E-mail já cadastrado" });
      }

      const session = await createSession(user.id);
      setSessionCookie(reply, session.id);
      return { id: user.id, email: user.email, name: user.name };
    },
  );

  app.post(
    "/auth/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = request.body as { email?: string; password?: string };
      if (!body?.email || !body.password) {
        return reply.code(400).send({ error: "E-mail e senha são obrigatórios" });
      }

      const user = await prisma.user.findUnique({ where: { email: normalizeEmail(body.email) } });
      const invalidCredentials = () => reply.code(401).send({ error: "E-mail ou senha inválidos" });

      if (!user?.passwordHash) return invalidCredentials();
      if (!(await verifyPassword(body.password, user.passwordHash))) return invalidCredentials();

      const session = await createSession(user.id);
      setSessionCookie(reply, session.id);
      return { id: user.id, email: user.email, name: user.name };
    },
  );

  app.post("/auth/logout", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE_NAME];
    if (token) {
      await prisma.authSession.deleteMany({ where: { id: token } });
    }
    reply.clearCookie(SESSION_COOKIE_NAME, { path: "/", domain: process.env.COOKIE_DOMAIN || undefined });
    return reply.code(204).send();
  });

  app.get("/auth/me", { preHandler: requireAuth }, async (request) => {
    const user = request.user!;
    return { id: user.id, email: user.email, name: user.name };
  });
}
