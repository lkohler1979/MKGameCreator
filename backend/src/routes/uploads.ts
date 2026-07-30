import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { FastifyInstance } from "fastify";

import { requireAuth } from "../lib/auth.js";

export const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// TODO(sprint-0): trocar por validação real (analise de desenho + moderação de
// conteúdo) assim que um provedor de IA for escolhido. Por ora só valida o mimetype.
const ALLOWED_MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/heic": "heic",
  "image/heif": "heif",
};

export async function registerUploadRoutes(app: FastifyInstance) {
  await mkdir(UPLOADS_DIR, { recursive: true });

  app.post("/uploads", { preHandler: requireAuth }, async (request, reply) => {
    const file = await request.file();

    if (!file) {
      return reply.code(400).send({ error: "Nenhum arquivo enviado" });
    }

    const extension = ALLOWED_MIME_EXTENSIONS[file.mimetype];
    if (!extension) {
      return reply.code(400).send({ error: "Formato de imagem não suportado" });
    }

    let buffer: Buffer;
    try {
      buffer = await file.toBuffer();
    } catch {
      return reply.code(413).send({ error: "Arquivo excede o tamanho máximo permitido" });
    }

    const filename = `${randomUUID()}.${extension}`;
    await writeFile(path.join(UPLOADS_DIR, filename), buffer);

    return { url: `/uploads/${filename}` };
  });
}
