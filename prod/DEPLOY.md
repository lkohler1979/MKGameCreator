# Deploy em produção - VPS 187.77.53.197

Guia passo a passo para subir o MKGameCreator no servidor, sem Docker
(instalação direta: Node.js + PostgreSQL nativo + PM2 + NGINX).

Este servidor já hospeda outro app (`treino.nexux360.com.br`, portas 3000 e
8080). O MKGameCreator usa portas diferentes (3001 e 8081) para conviver com
ele sem conflito - se algum dia isso mudar, ajuste as portas nos arquivos
`prod/ecosystem.config.js` e `prod/nginx/*.conf` e refaça os passos 9 e 10.

## Arquitetura

```
Internet
  |
  v
NGINX (porta 80/443)
  |
  |-- mkgamecreator.unifyhub.com.br      -> 127.0.0.1:3001 (Next.js, gerenciado pelo PM2)
  |-- apimkgamecreator.unifyhub.com.br   -> 127.0.0.1:8081 (Fastify, gerenciado pelo PM2)
  v
PostgreSQL (local, porta 5432, só acesso via localhost)
```

Layout final em `/var/www/mkgamecreator`:

```
/var/www/mkgamecreator/
├── app/                 <- clone do repositório git (fonte da verdade, atualizado com `git pull`)
├── backend  -> app/backend      (symlink)
├── frontend -> app/apps/web     (symlink)
└── ecosystem.config.js  <- copiado de app/prod/ecosystem.config.js (config do PM2)
```

Os nomes `backend` e `frontend` existem como symlinks para as pastas reais
dentro do clone `app/`. Assim, um `git pull` dentro de `app/` já atualiza o
código usado pelos dois processos, sem precisar duplicar nada.

> **Uploads dos usuários (desenhos/sprites):** o backend salva os arquivos
> enviados em `backend/uploads/` (relativo ao `cwd` do processo, ou seja,
> dentro do próprio clone `app/backend/uploads`). Essa pasta está no
> `.gitignore` do repo, então o `git clean -fd` do `deploy.sh` (passo de
> atualização) **não apaga** os uploads a cada deploy - `git clean` sem `-x`
> preserva arquivos ignorados. Nada extra a fazer aqui.

> **Autenticação ainda não está implementada** (login real fica para uma
> fase futura do roadmap - ver `docs/ROADMAP.md`). Todo jogo criado em
> produção pertence a um único usuário fixo de desenvolvimento (`dev@local`).
> Ou seja: qualquer pessoa que acessar o site consegue ver/criar/apagar os
> jogos desse mesmo usuário. Isso é aceitável para uma demo/teste, mas **não
> é seguro para uso público real** até a autenticação ser implementada.

Pré-requisito: os domínios `mkgamecreator.unifyhub.com.br` e
`apimkgamecreator.unifyhub.com.br` já apontam (registro A) para
`187.77.53.197`.

---

## 1. Acessar o servidor

```bash
ssh root@187.77.53.197
```

## 2. Node.js e npm

Se este servidor já roda o `treino.nexux360.com.br`, o Node.js já está
instalado - confirme e pule para o passo 3:

```bash
node -v   # confirme que é v20.6+ (precisa do --env-file nativo) - o treino usa v24.x
```

Se não estiver instalado:

```bash
sudo apt update && sudo apt upgrade -y

curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs

node -v   # confirme que é v24.x
npm -v
```

O MKGameCreator usa **npm workspaces** (não pnpm) - não precisa instalar
mais nada além do que já vem com o Node.

## 3. PostgreSQL

Se já estiver instalado (por causa do treino), pule a instalação e só crie o
usuário/banco novos abaixo.

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

Criar o usuário e o banco dedicados ao MKGameCreator (troque
`SENHA_FORTE_AQUI`):

```bash
sudo -u postgres psql -c "CREATE USER mkgamecreator WITH PASSWORD 'SENHA_FORTE_AQUI';"
sudo -u postgres psql -c "CREATE DATABASE mkgamecreator OWNER mkgamecreator;"
```

A `DATABASE_URL` resultante (usada no passo 7) é:

```
postgresql://mkgamecreator:SENHA_FORTE_AQUI@localhost:5432/mkgamecreator?schema=public
```

## 4. PM2 (gerenciador de processos)

Se já estiver instalado (por causa do treino), pule.

```bash
sudo npm install -g pm2
pm2 -v
```

## 5. NGINX e Certbot

Se já estiverem instalados, pule.

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

sudo systemctl enable nginx
sudo systemctl start nginx
```

Se houver firewall (`ufw`) ativo:

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
```

## 6. Clonar o repositório e criar a estrutura de pastas

```bash
sudo mkdir -p /var/www/mkgamecreator
cd /var/www/mkgamecreator

sudo git clone https://github.com/lkohler1979/MKGameCreator.git app

sudo ln -s app/backend backend
sudo ln -s app/apps/web frontend

sudo cp app/prod/ecosystem.config.js ecosystem.config.js
```

Confirme que `backend` e `frontend` aparecem (como symlinks):

```bash
ls -la /var/www/mkgamecreator
```

## 7. Configurar e buildar o backend

```bash
cd /var/www/mkgamecreator/backend
sudo cp .env.example .env
sudo nano .env
```

Preencha (o backend não usa dotenv - quem carrega o `.env` é o PM2 via
`node_args: "--env-file=.env"` no `ecosystem.config.js`, então o formato
precisa ser `CHAVE=valor` simples, uma por linha, sem `export`):

```
PORT=8081
DATABASE_URL="postgresql://mkgamecreator:SENHA_FORTE_AQUI@localhost:5432/mkgamecreator?schema=public"
```

As variáveis `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` do `.env.example` não
são necessárias ainda - auth/storage reais não estão integrados (ver nota no
topo deste arquivo).

> Não rode `npx prisma` ainda neste passo - o `node_modules` do monorepo só
> existe depois do `npm ci` no passo 8. Rodar `npx prisma` antes disso faz o
> npx baixar o `prisma@latest` (hoje a major 7, que quebra este schema) em
> vez de usar a versão fixada em `backend/package.json` (6.19.x). O passo 8
> cobre install, build e migrations juntos, na ordem certa.

## 8. Configurar o frontend, instalar, buildar e migrar

```bash
cd /var/www/mkgamecreator/frontend
sudo cp .env.example .env.production
sudo nano .env.production
```

Preencha:

```
NEXT_PUBLIC_API_URL=https://apimkgamecreator.unifyhub.com.br
API_INTERNAL_URL=http://127.0.0.1:8081
```

> `NEXT_PUBLIC_API_URL` é usado pelo navegador (fica embutido no JS no
> build). `API_INTERNAL_URL` é usado só no servidor (Server Components) para
> falar direto com o backend em localhost, sem passar pelo NGINX/HTTPS -
> mais rápido e evita uma dependência circular de DNS/certificado.
> `NEXT_PUBLIC_SUPABASE_*` do `.env.example` não são necessárias ainda (mesma
> razão do passo 7).

> O Next.js carrega `.env.production` nativamente, tanto no build quanto no
> `next start` - não precisa de nenhuma configuração extra no PM2 para isso
> (diferente do backend).

Agora, com os dois `.env` já criados, instale as dependências do monorepo
(workspaces), builde os dois lados e rode as migrations - **nesta ordem**
(o `npm run build -w backend` já roda `prisma generate` internamente, e o
`--no-install` garante que o `npx` use a versão do Prisma fixada no
`package.json` em vez de tentar baixar a mais recente):

```bash
cd /var/www/mkgamecreator/app
npm ci
npm run build -w backend

set -a && source backend/.env && set +a
(cd backend && npx --no-install prisma migrate deploy)

npm run build -w web
```

> O `(cd backend && ...)` acima usa parênteses de propósito - isso roda num
> subshell, então o diretório atual do terminal não muda depois do comando.
> Evite `cd backend && ... && cd ..`: como existem dois caminhos válidos para
> "backend" nesta estrutura (o symlink `/var/www/mkgamecreator/backend` e a
> pasta real `app/backend`), o `cd ..` pode devolver pra um lugar diferente
> do esperado dependendo de qual dos dois você usou pra entrar - o bash
> mantém o caminho lógico (não resolvido), não o caminho físico.

> O pacote `prisma` não fica com o binário em `node_modules/.bin` na raiz
> do monorepo - ele fica em `backend/node_modules/.bin`. O `npx` só procura
> `node_modules/.bin` **subindo** a partir do diretório atual, nunca descendo
> em subpastas - por isso o `cd backend` antes do `npx` é obrigatório (rodar
> de `/var/www/mkgamecreator/app` direto dá `prisma: not found`, mesmo com
> tudo instalado corretamente).

## 9. Subir os processos com o PM2

```bash
cd /var/www/mkgamecreator
pm2 start ecosystem.config.js

pm2 status
```

Configurar o PM2 para iniciar junto com o servidor (sobrevive a reboot - só
precisa fazer isso uma vez por servidor; se o treino já fez isso, pule):

```bash
pm2 save
pm2 startup
```

O `pm2 startup` imprime um comando `sudo env PATH=... pm2 startup systemd -u root --hp /root`
— copie e execute exatamente o que ele mostrar.

## 10. Configurar o NGINX

```bash
sudo cp /var/www/mkgamecreator/app/prod/nginx/mkgamecreator.conf /etc/nginx/sites-available/mkgamecreator.conf
sudo cp /var/www/mkgamecreator/app/prod/nginx/apimkgamecreator.conf /etc/nginx/sites-available/apimkgamecreator.conf

sudo ln -s /etc/nginx/sites-available/mkgamecreator.conf /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/apimkgamecreator.conf /etc/nginx/sites-enabled/

sudo nginx -t
sudo systemctl reload nginx
```

> Não remova o site `default` nem os sites do treino aqui - este servidor
> hospeda os dois apps.

Neste ponto, `http://mkgamecreator.unifyhub.com.br` e
`http://apimkgamecreator.unifyhub.com.br` já devem funcionar (ainda sem
HTTPS).

## 11. Ativar HTTPS com Certbot

```bash
sudo certbot --nginx -d mkgamecreator.unifyhub.com.br
sudo certbot --nginx -d apimkgamecreator.unifyhub.com.br
```

O certbot edita os arquivos em `/etc/nginx/sites-available/` automaticamente,
adicionando o bloco `listen 443 ssl` e o redirect de HTTP para HTTPS. Não é
necessário editar nada manualmente.

Testar a renovação automática (se o treino já tem o timer instalado, ele já
cobre os certificados novos também):

```bash
sudo certbot renew --dry-run
```

## 12. Testar

```bash
curl -I https://mkgamecreator.unifyhub.com.br
curl -I https://apimkgamecreator.unifyhub.com.br
curl https://apimkgamecreator.unifyhub.com.br/health   # deve retornar {"status":"ok","service":"mkgamecreator-backend"}
```

Abra `https://mkgamecreator.unifyhub.com.br` no navegador e percorra o fluxo
completo (Splash → Home → Novo Jogo → upload de um desenho → Escolher
Personagem → Gerar Jogo → Jogar) para confirmar que backend, banco e uploads
estão funcionando de ponta a ponta.

---

## Atualizações futuras (novo deploy)

Sempre que o código mudar, rode o script `deploy.sh` (já vem no repo, em
`app/prod/deploy.sh`):

```bash
cd /var/www/mkgamecreator
chmod +x app/prod/deploy.sh   # só na primeira vez (o arquivo foi editado no Windows, sem bit de execução)
./app/prod/deploy.sh
```

Ele faz, em ordem, parando no primeiro erro: atualiza `app/` a partir da
`main` (se houver qualquer alteração local - commitada ou não - ela é
descartada antes; a pasta em produção deve sempre refletir exatamente o
que está na `main`; os uploads dos usuários não são afetados, ver nota no
topo deste arquivo), instala as dependências (`npm ci` na raiz do
monorepo), builda o backend, roda `prisma migrate deploy`, builda o
frontend, reinicia os dois processos no PM2 e testa se `127.0.0.1:8081` e
`127.0.0.1:3001` respondem.

Um deploy já em andamento é detectado (lock file em
`/tmp/mkgamecreator-deploy.lock`) e uma segunda execução simultânea é
recusada.

Equivalente manual, passo a passo (caso quira rodar sem o script):

```bash
cd /var/www/mkgamecreator/app
git pull

npm ci
npm run build -w backend

set -a && source backend/.env && set +a
(cd backend && npx --no-install prisma migrate deploy)   # só se houver migration nova

npm run build -w web

cd /var/www/mkgamecreator
pm2 restart ecosystem.config.js --update-env
```

## Comandos úteis / troubleshooting

```bash
# status e logs dos processos
pm2 status
pm2 logs mkgamecreator-api
pm2 logs mkgamecreator-frontend

# reiniciar um processo
pm2 restart mkgamecreator-api

# logs do nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# validar config do nginx antes de recarregar
sudo nginx -t

# status do postgres
sudo systemctl status postgresql

# ver quem esta usando cada porta, se suspeitar de conflito com o treino
sudo ss -tlnp | grep -E ':(3001|8081|3000|8080)\b'
```
