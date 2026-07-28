# CLAUDE.md

## Projeto
MKGameCreator é uma plataforma web para transformar desenhos em jogos 2D.

## Documentação (docs/) — leitura obrigatória antes de qualquer tarefa
Antes de planejar ou alterar qualquer parte do código, leia:
- `docs/PRD.md` — escopo do MVP (7 telas: Splash, Home, Upload, Escolher Personagem, Gerar Jogo, Jogar, Compartilhar), regras de cada tela, conceito visual e requisitos não funcionais. É a fonte de verdade do "o quê" construir.
- `docs/TASKS.md` — backlog de tasks por sprint. É a fonte de verdade do "o que fazer agora"; ao concluir uma task, marque o checkbox correspondente.
- `docs/PLANO_DESENVOLVIMENTO.md` — arquitetura técnica, pipeline de IA, cronograma, riscos e critério de "Definição de Pronto" por sprint. Cobre hoje o que os arquivos `ARCHITECTURE.md`, `GAME_ENGINE.md`, `AI_PIPELINE.md` e `ROADMAP.md` da estrutura abaixo vão assumir quando forem desmembrados.

Os demais arquivos previstos na estrutura (`ARCHITECTURE.md`, `UI_GUIDELINES.md`, `API.md`, `DATABASE.md`, `GAME_ENGINE.md`, `AI_PIPELINE.md`, `PROMPTS.md`) ainda não existem. `docs/ROADMAP.md` já foi criado — planeja a evolução pós-MVP rumo ao nível de produto do Pixicade (variedade de jogos, inimigos com comportamento, comunidade, multiplayer). Enquanto não forem criados, o conteúdo equivalente está em `PRD.md`/`PLANO_DESENVOLVIMENTO.md`. Quando um desses arquivos for criado, ele passa a ser a referência para sua área e deve ser lido antes de qualquer alteração correspondente (ex.: não tocar no motor de jogo sem ler `GAME_ENGINE.md`, se existir).

Nunca implemente uma funcionalidade fora do escopo descrito em `docs/PRD.md` sem confirmar com o time — o MVP está deliberadamente fechado em 7 telas e um único template de jogo.

## Stack
- Next.js 15
- React 19
- TypeScript
- TailwindCSS
- shadcn/ui
- PixiJS (render do jogo)
- Matter.js (física do jogo)
- Fastify (API REST)
- Prisma
- PostgreSQL
- Supabase Auth/Storage

## Regras
- Componentes pequenos.
- Clean Architecture.
- Feature-first.
- Testes obrigatórios.
- Não usar lógica na UI.
- APIs REST.
- Tipagem estrita.
- ESLint + Prettier.

## Fluxo MVP
Login → Novo Jogo → Upload → Remoção de Fundo → Escolha do Personagem → Gerar → Jogar → Compartilhar.

## Estrutura de diretório
```
MKGameCreator/
├── docs/
│   ├── CLAUDE.md
│   ├── PRD.md                    ✅ criado
│   ├── TASKS.md                  ✅ criado
│   ├── PLANO_DESENVOLVIMENTO.md  ✅ criado (cobre arquitetura/roadmap até ARCHITECTURE.md, GAME_ENGINE.md, AI_PIPELINE.md e ROADMAP.md serem desmembrados)
│   ├── ARCHITECTURE.md           ⏳ pendente
│   ├── UI_GUIDELINES.md          ⏳ pendente
│   ├── API.md                    ⏳ pendente
│   ├── DATABASE.md               ⏳ pendente
│   ├── GAME_ENGINE.md            ⏳ pendente
│   ├── AI_PIPELINE.md            ⏳ pendente
│   ├── ROADMAP.md                ⏳ pendente
│   └── PROMPTS.md                ⏳ pendente
│
├── apps/
├── packages/
├── backend/
```
