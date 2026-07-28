import { mkdir } from "node:fs/promises";

import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import staticPlugin from "@fastify/static";
import Fastify from "fastify";

import { registerGameRoutes } from "./routes/games.js";
import { registerUploadRoutes, UPLOADS_DIR } from "./routes/uploads.js";

const app = Fastify({ logger: true });

await mkdir(UPLOADS_DIR, { recursive: true });

await app.register(cors, {
  origin: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
});

await app.register(multipart, {
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

await app.register(staticPlugin, {
  root: UPLOADS_DIR,
  prefix: "/uploads/",
});

await registerUploadRoutes(app);
await registerGameRoutes(app);

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
