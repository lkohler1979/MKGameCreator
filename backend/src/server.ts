import { mkdir } from "node:fs/promises";

import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import staticPlugin from "@fastify/static";
import Fastify from "fastify";

import { registerAuthRoutes } from "./routes/auth.js";
import { registerColorConfigRoutes } from "./routes/color-config.js";
import { registerGameRoutes } from "./routes/games.js";
import { registerUploadRoutes, UPLOADS_DIR } from "./routes/uploads.js";

const app = Fastify({ logger: true });

await mkdir(UPLOADS_DIR, { recursive: true });

// origin precisa ser explícito (não `true`/reflect-all) agora que existe
// cookie de sessão - com credentials:true, refletir qualquer origem
// deixaria qualquer site ler dados autenticados do navegador de uma vítima.
await app.register(cors, {
  origin: process.env.CORS_ORIGIN || "http://localhost:3050",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
});

await app.register(cookie);

// global:false - só as rotas que pedirem explicitamente via
// `config: { rateLimit: {...} }` (login/signup) ficam limitadas.
await app.register(rateLimit, { global: false });

await app.register(multipart, {
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

await app.register(staticPlugin, {
  root: UPLOADS_DIR,
  prefix: "/uploads/",
});

await registerAuthRoutes(app);
await registerUploadRoutes(app);
await registerGameRoutes(app);
await registerColorConfigRoutes(app);

app.get("/health", async () => {
  return { status: "ok", service: "mkgamecreator-backend" };
});

const port = Number(process.env.PORT ?? 3333);

app
  .listen({ port, host: "0.0.0.0" })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
