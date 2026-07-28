#!/usr/bin/env bash
# Redeploy do MKGameCreator na VPS depois de uma mudanca de codigo.
#
# Uso (na VPS, dentro de /var/www/mkgamecreator):
#   ./app/prod/deploy.sh
#
# O que faz, em ordem: git pull, install (npm workspaces), build do backend,
# migrations do Prisma, build do frontend, restart dos processos no PM2.
# Para no primeiro erro.

set -euo pipefail

ROOT_DIR="/var/www/mkgamecreator"
APP_DIR="$ROOT_DIR/app"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
LOCK_FILE="/tmp/mkgamecreator-deploy.lock"

log() {
  printf '\n\033[1;36m[deploy] %s\033[0m\n' "$1"
}

fail() {
  printf '\n\033[1;31m[deploy] ERRO: %s\033[0m\n' "$1" >&2
  exit 1
}

exec 200>"$LOCK_FILE"
flock -n 200 || fail "ja existe um deploy em andamento (lock: $LOCK_FILE)"

[ -d "$APP_DIR/.git" ] || fail "repositorio nao encontrado em $APP_DIR"
[ -f "$BACKEND_DIR/.env" ] || fail "faltando $BACKEND_DIR/.env (veja prod/DEPLOY.md)"
[ -f "$FRONTEND_DIR/.env.production" ] || fail "faltando $FRONTEND_DIR/.env.production (veja prod/DEPLOY.md)"

log "1/5 - Atualizando o repositorio (git pull)"
cd "$APP_DIR"

if [ -n "$(git status --porcelain)" ]; then
  log "Alteracoes locais encontradas em $APP_DIR - descartando (producao sempre reflete a main)"
  # backend/uploads fica dentro do clone (backend -> app/backend), mas esta
  # no .gitignore - "git clean -fd" (sem -x) preserva arquivos ignorados,
  # entao os desenhos/sprites gerados pelos usuarios nao sao apagados aqui.
  git reset --hard HEAD
  git clean -fd
fi

git fetch origin main
git checkout main
git reset --hard origin/main

log "2/5 - Instalando dependencias (npm workspaces, na raiz do monorepo)"
npm ci

log "3/5 - Buildando o backend (prisma generate + tsc) e rodando migrations"
npm run build -w backend

# O script deploy.sh nao herda o .env do backend (quem carrega e o PM2 via
# node_args --env-file), entao exporta DATABASE_URL aqui so para o comando
# de migration conseguir rodar.
set -a
# shellcheck disable=SC1091
source "$BACKEND_DIR/.env"
set +a
npx --no-install prisma migrate deploy --schema=backend/prisma/schema.prisma

log "4/5 - Buildando o frontend (Next.js)"
npm run build -w web

log "5/5 - Reiniciando os processos no PM2"
cp "$APP_DIR/prod/ecosystem.config.js" "$ROOT_DIR/ecosystem.config.js"
cd "$ROOT_DIR"
pm2 restart ecosystem.config.js --update-env
pm2 save

sleep 2

log "Verificando os processos"
pm2 status

log "Checando as portas locais"
curl -fsS -o /dev/null -w "backend  (127.0.0.1:8081/health): %{http_code}\n" http://127.0.0.1:8081/health || echo "backend  (127.0.0.1:8081): SEM RESPOSTA"
curl -fsS -o /dev/null -w "frontend (127.0.0.1:3001): %{http_code}\n" http://127.0.0.1:3001/ || echo "frontend (127.0.0.1:3001): SEM RESPOSTA"

log "Deploy concluido"
