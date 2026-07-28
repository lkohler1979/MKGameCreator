import { prisma } from "./prisma.js";

const DEV_USER_EMAIL = "dev@local";

// TODO(auth): substituir por autenticação real (Supabase Auth) — enquanto o
// login segue pulado (Sprint 1), todo jogo/sprite criado fica associado a
// este usuário fixo de desenvolvimento.
export async function getOrCreateDevUser() {
  return prisma.user.upsert({
    where: { email: DEV_USER_EMAIL },
    update: {},
    create: {
      email: DEV_USER_EMAIL,
      name: "Dev User",
      provider: "DEV",
    },
  });
}
