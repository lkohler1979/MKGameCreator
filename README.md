# README.md

## Projeto
MKGameCreator é uma plataforma web para transformar desenhos em jogos 2D.

Documentação completa (PRD, tasks, plano de desenvolvimento) em [docs/](docs/CLAUDE.md).

## Estrutura
```
apps/web/   Next.js 15 + React 19 + TypeScript + Tailwind + shadcn/ui
backend/    Fastify + Prisma
```

## Desenvolvimento

Pré-requisitos: Docker Desktop.

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp apps/web/.env.example apps/web/.env

docker compose up --build
```

Na primeira vez, aplique as migrations do Prisma no Postgres do container:

```bash
docker compose exec backend npx prisma migrate dev --name init
```

Serviços (portas escolhidas para não colidir com outros projetos já rodando nesta máquina):
- Web: http://localhost:3050
- Backend (Fastify): http://localhost:3333 (`/health` para checar se está no ar)
- Postgres: localhost:5442 (user/senha/db em `.env.example`)

Código de `apps/web` e `backend` é montado por volume, então o hot-reload funciona editando os arquivos localmente — não precisa reconstruir a imagem a cada mudança (só ao alterar `package.json`/`Dockerfile.dev`).

Supabase Auth/Storage ainda não estão integrados (dependem de um projeto Supabase real) — preencher `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` nos `.env` quando o projeto for criado (Sprint 1 do `docs/TASKS.md`).

