# CLAUDE.md

## Projeto
MKGameCreator é uma plataforma web para transformar desenhos em jogos 2D.

## Documentação (docs/) — leitura obrigatória antes de qualquer tarefa
Antes de planejar ou alterar qualquer parte do código, leia:
- `docs/REQUISITOS.MD` — especificação de produto mais completa e autoritativa hoje (vai além do MVP original: perfil infantil, sistema de cores/comportamentos, editor visual, ranking, comunidade, multiplayer, área escolar/responsável, monetização, app mobile nativo, arquitetura sugerida NestJS+Redis+S3). Onde conflitar com `PRD.md`/`PLANO_DESENVOLVIMENTO.md` (que descrevem só o MVP original), `REQUISITOS.MD` prevalece para a visão de produto pós-MVP — ver `docs/ROADMAP.md` para como isso foi sequenciado sem descartar o que já existe.
- `docs/PRD.md` — escopo do MVP (7 telas: Splash, Home, Upload, Escolher Personagem, Gerar Jogo, Jogar, Compartilhar), regras de cada tela, conceito visual e requisitos não funcionais. Fonte de verdade do MVP original já entregue.
- `docs/TASKS.md` — backlog de tasks por sprint/fase. É a fonte de verdade do "o que fazer agora"; ao concluir uma task, marque o checkbox correspondente.
- `docs/PLANO_DESENVOLVIMENTO.md` — arquitetura técnica, pipeline de IA, cronograma, riscos e critério de "Definição de Pronto" por sprint do MVP original.
- `docs/ROADMAP.md` — evolução pós-MVP: gap analysis contra Pixicade e contra `REQUISITOS.MD`, fases sequenciadas (produto sobre a stack atual → migração de arquitetura → app mobile → multiplayer → IA avançada).

Os demais arquivos previstos na estrutura (`ARCHITECTURE.md`, `UI_GUIDELINES.md`, `API.md`, `DATABASE.md`, `GAME_ENGINE.md`, `AI_PIPELINE.md`, `PROMPTS.md`) ainda não existem — o conteúdo equivalente está nos arquivos acima. Quando um desses arquivos for criado, ele passa a ser a referência para sua área e deve ser lido antes de qualquer alteração correspondente (ex.: não tocar no motor de jogo sem ler `GAME_ENGINE.md`, se existir).

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
