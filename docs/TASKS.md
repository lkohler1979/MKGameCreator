# TASKS — MK Game Creator (MVP, 7 telas)

Referência: PRD.md e PLANO_DESENVOLVIMENTO.md. Sprints de 2 semanas.

## Sprint 0 — Fundação
- [x] Escolher e validar o provedor de IA/segmentação de imagem: `@imgly/background-removal` (roda no navegador, sem custo de API externa) — em uso em `apps/web/src/app/new-game/page.tsx`.
- [x] Setup do monorepo (apps/, packages/, backend/), ambientes (dev via `docker-compose.yml`, prod via `prod/DEPLOY.md`).
- [ ] CI/CD — não existia; ver Sprint 0 abaixo (workflow novo adicionado nesta rodada, `.github/workflows/ci.yml`, roda `tsc`+`eslint` no frontend e backend a cada push/PR). Falta deploy automático (`prod/DEPLOY.md` continua manual).
- [x] Prisma + PostgreSQL configurados e em uso (`backend/prisma/schema.prisma`, `docker-compose.yml`).
- [ ] ~~Configurar Supabase Auth/Storage~~ — decisão tomada na Fase 3 de **não** usar Supabase: autenticação própria (e-mail+senha, sessão via cookie) implementada em `backend/src/routes/auth.ts`. Supabase Storage nunca chegou a ser necessário (upload local via `@fastify/static`, ver `backend/src/routes/uploads.ts`). Fica como decisão arquitetural registrada, não como pendência.
- [x] Design system em Tailwind/shadcn: paleta (`globals.css`), tipografia (Baloo 2 + Nunito), componentes (`components/ui/`).
- [x] Modelagem de dados (Prisma schema): usuário, jogo, sprite, sessão de jogo, favoritos, denúncias — bem além do MVP original, ver `backend/prisma/schema.prisma`.
- [x] Contrato da API REST (Fastify) implementado (`backend/src/routes/`) — não existe um doc de spec formal (ex. OpenAPI) à parte, mas as rotas em si cobrem o contrato.
- [x] Estratégia de moderação de conteúdo mínima definida e implementada (Fase 4.7: filtro de nome + denúncia). Conformidade LGPD/consentimento do responsável fica na Fase 4.5, **adiada a pedido do usuário** (decisões de idade/vínculo/revogação ainda em aberto).

## Sprint 1 — Splash, Login e Home
- [x] Tela Splash: logo, proposta de valor, CTA "Começar".
- [ ] Login social Google — decorativo (`components/brand-icons.tsx`), sem credenciais OAuth reais ainda; login funcional hoje é e-mail+senha.
- [ ] Login social Microsoft — mesma situação do Google acima.
- [x] Home: header com logo + notificação + logout (não há avatar/foto de perfil de fato — "Perfil" no menu inferior é decorativo, ver Fase 4.5).
- [x] Home: botão de destaque "+ Novo Jogo".
- [x] Home: grid "Meus Jogos" (nome + botão "▶ Jogar") — evoluiu pra abas Todos/Públicos/Privados/Favoritos na Fase 4.4.
- [ ] Teste de usabilidade: login → Home em até 2 toques — não dá pra validar com usuário real neste ambiente; por desenho, o fluxo é rápido (e-mail+senha → redirect automático).

## Sprint 2 — Upload do Desenho
- [x] Tela de upload: área de arraste da imagem.
- [x] Opção "Tirar Foto" (câmera) — `<input capture="environment">`, abre câmera nativa no navegador móvel; validação em hardware real ainda pendente (Fase 5).
- [x] Opção "Escolher Arquivo" (PNG/JPG/HEIC) + validação de formato/tamanho.
- [x] Integração: etapa de análise do desenho — hoje é uma simulação visual (sempre aprova, `TODO(sprint-0)` no código); moderação automática de imagem de verdade é Fase 7 (visão computacional).
- [x] Integração: etapa de remoção de fundo (`@imgly/background-removal`, real).
- [ ] Moderação automática de conteúdo antes de liberar o "Continuar" — mesma situação do item de análise acima: stub que sempre aprova, moderação de imagem de verdade fica pra Fase 7.
- [x] Tela de resultado "Original vs. Resultado" com "✓ Fundo removido".
- [ ] Medir e otimizar tempo dessa etapa (meta ≤ 15s) — nunca formalmente cronometrado/otimizado.

## Sprint 3 — Escolher Personagem e Gerar Jogo
- [x] Tela "Escolher Personagem": opção "Meu Desenho" selecionável + "Meus Personagens" (avatar persistente, Fase 3).
- [x] Galeria de personagens prontos (robô, dinossauro, astronauta, ninja, gato, sapo, fantasma, macaco) — via emoji rasterizado (`rasterize-emoji.ts`), não ilustração própria.
- [x] Tela "Gerar Jogo": seleção de template — evoluiu de "card único Plataforma" pra 3 templates (Plataforma/Labirinto/Coleta de Itens, Fase 2 e 4.1).
- [x] Botão "Criar Meu Jogo" disparando o pipeline completo.
- [x] Tela de animação de progresso (checklist Analisando → Removendo fundo → Criando personagem → Construindo cenário → Pronto).
- [ ] Integração: normalização de pose do sprite (corrida/pulo animados) — sprite é estático hoje; é literalmente item da Fase 7 (IA avançada), não implementado.
- [x] Integração: montagem do cenário — evoluiu de "só Plataforma" pra `scene-config-builder.ts` cobrindo os 3 templates, com editor manual na Fase 4.2.
- [ ] Medir e otimizar tempo do pipeline completo (meta ≤ 45s) — nunca formalmente cronometrado/otimizado.

## Sprint 4 — Motor do Jogo (Jogar)
- [x] Motor de jogo (PixiJS + Matter.js) — hoje 3 motores (`platform-game.ts`/`maze-game.ts`/`collect-game.ts`) atrás de uma interface comum (`game-engine.ts`).
- [x] Física de corrida e pulo, colisão com plataformas e obstáculos.
- [x] Moedas coletáveis e bandeira de chegada.
- [x] HUD: vidas (❤❤❤) e contador de moedas — mais contador de tempo pro template Coleta de Itens.
- [x] Controles touch (← → ↑ / cruz direcional) e teclado.
- [x] Botões "Reiniciar" e "Tela Cheia".
- [ ] Teste de performance em dispositivo Android de entrada (meta 60fps) — precisa de hardware real, não disponível neste ambiente.

## Sprint 5 — Compartilhar, Polimento e QA
- [x] Tela de vitória: estrelas, tempo, moedas, animação de confetti.
- [x] Ação "Compartilhar" (share nativo, com fallback pra copiar link).
- [x] Ação "Copiar Link" (link público do jogo).
- [x] Ação "Editar" — evoluiu de "retorna ao fluxo" pra reabrir o cenário real no editor (Fase 4.2), sem perder o que já foi criado.
- [x] Ação "Criar Outro" (reinicia o fluxo).
- [x] Polimento de transições/animações (fade-in-up) nas telas principais.
- [ ] QA end-to-end cronometrado do fluxo completo (meta ≤ 60s) — testado funcionalmente em várias rodadas nesta sessão, mas nunca cronometrado formalmente.
- [ ] Teste de usabilidade com crianças (meta: 80% completam sem ajuda de adulto) — precisa de usuários reais, não disponível neste ambiente.
- [ ] Revisão final de moderação de conteúdo e privacidade antes do lançamento beta — moderação mínima (Fase 4.7) e auditoria de responsividade (Fase 5) já feitas; revisão formal de privacidade/LGPD completa depende da Fase 4.5 (adiada).

## Pós-MVP: ver docs/ROADMAP.md e docs/REQUISITOS.MD

`docs/REQUISITOS.MD` é hoje a especificação mais completa de produto (substitui o antigo "Backlog pós-MVP" solto abaixo — ver `docs/ROADMAP.md` §5 para o raciocínio completo de sequenciamento). Fases 1-3 já entregues (som/powerups/inimigos, templates plugáveis + Labirinto, autenticação real + avatar persistente).

### Fase 4 — Fechar o MVP conforme docs/REQUISITOS.MD (sobre a stack atual)
Ordem recomendada: 4.3 → 4.4 → 4.1 → 4.2 → 4.5 → 4.7 → 4.6.

**4.1 Mais categorias de objeto** ✅
- [x] Estender `ElementRole`/`element-roles.ts` com Inimigo (persegue o jogador), Bloco destrutível, Objeto Dinâmico. NPC e Portal/teleporte ficaram pra uma rodada futura (dependem de sistema de diálogo e UI de pareamento, respectivamente).
- [x] Estender `scene-config-builder.ts` e os motores (`platform-game.ts`, `maze-game.ts`) pra interpretar as novas categorias.
- [x] Novo template de jogo aproveitando as categorias novas (Coleta de Itens: arena aberta, cronômetro de 60s, vitória ao coletar todas as moedas).
- [x] Configuração de cores (`/configuracoes/cores`): mapa cor→categoria editável por usuário (`User.colorRoleMap`), inspirado na tabela "Cores Base" do REQUISITOS.MD, usado pra pré-selecionar a categoria sugerida na tela de marcação (a criança continua podendo trocar qualquer uma).

**4.2 Editor básico** ✅
- [x] Tela nova (`new-game/edit`) pra mover, redimensionar, trocar tipo, excluir e adicionar objetos do `sceneConfig` — editor visual (arraste) pra Plataforma, lista simples (contagem+tipo) pra Labirinto/Coleta de Itens.
- [x] Persistir a edição manual (o `sceneConfig` editado substitui o gerado automaticamente, via `sessionStorage` no fluxo de criação ou `PATCH /games/:id` num jogo já salvo).
- [x] Reabrir o editor a partir de um jogo já salvo (botão "Editar" da tela de vitória agora carrega o cenário real em vez de reiniciar o assistente).

**4.3 Ranking de pontuação** ✅
- [x] Endpoint novo (`GET /games/:id/ranking`) agregando `GameSession` por jogo (maior pontuação, menor tempo).
- [x] Tela/seção de ranking na página do jogo.

**4.4 Biblioteca de jogos com categorias** ✅
- [x] Campo de visibilidade em `Game` (PRIVATE/PUBLIC) — migration nova.
- [x] Tabela de favoritos (usuário ↔ jogo).
- [x] Abas na Home: Todos/Públicos/Privados/Favoritos.

**4.5 Perfil infantil + controle parental mínimo** ⏸️ adiada
- [ ] Campos novos em `User` (data de nascimento, responsável_id) — migration nova, aditiva.
- [ ] Tela de consentimento do responsável no cadastro (quando idade indicar menor de idade).
- [ ] Visão mínima do responsável: ver jogos da criança, revogar acesso.
- Adiada a pedido do usuário: falta fechar limite de idade, mecanismo de vínculo com responsável (`responsavelId` é FK pra `User` já existente, não e-mail solto) e o que exatamente "revogar acesso" faz.

**4.7 Moderação mínima (pré-requisito prático de 4.6)** ✅
- [x] Filtro de nomes de jogos antes de criar (`backend/src/lib/content-filter.ts`) — só nome, não há campo de descrição no `Game` hoje.
- [x] Denúncia simples (model `GameReport`, `POST /games/:id/report`) em vez de fila de aprovação manual — aprovação automática + denúncia é a alternativa que o próprio REQUISITOS.MD permite.

**4.6 Comunidade básica** ✅
- [x] Tela de descoberta (`/comunidade`) listando jogos com visibilidade pública de todos os usuários (`GET /games/community`).
- [x] Curtidas simples reaproveitando o model `Favorite` já existente (sem chat livre, conforme recomendação do REQUISITOS.MD §7.19).

### Fase 5 — Web funcionando bem em celular (sem app nativo; PostgreSQL + Fastify mantidos)
- [x] Auditoria de responsividade em todas as telas (existentes + as novas da Fase 4) em viewport emulado (375×812, 320×568) — feita nesta rodada; **ainda falta repetir em dispositivo móvel real** (Android/iOS físicos), que este ambiente não tem como fazer.
  - [x] Corrigido: área de jogo (`play/[id]/page.tsx`) ficava minúscula em telas altas/estreitas — agora ajusta ao eixo mais restritivo via `ResizeObserver`.
  - [x] Corrigido: elementos arrastáveis do Editor sem `touch-action: none` (risco de o navegador roubar o gesto como rolagem) — adicionado `touch-none` + alça de redimensionar maior.
  - [x] Adicionado aviso "Gire o celular" em telas pequenas/retrato na tela Jogar.
- [x] Validar controles touch da tela Jogar (tamanho de toque, posicionamento) em telas pequenas — medido em viewport emulado, todos os alvos ≥40px.
- [ ] Validar captura de foto (`capture="environment"`) em navegador móvel real (Android e iOS) — precisa de hardware real, pendente.
- [x] PWA leve (manifest + ícone de instalação): `app/manifest.ts` + ícones gerados via `next/og` (`icon.tsx`, `apple-icon.tsx`, rotas `icon-192`/`icon-512`) com a identidade visual já existente (gradiente roxo + "MK" dourado). `theme-color` e meta tags de `apple-mobile-web-app` no layout raiz.

### Fase 6 — Multiplayer local e online ⏸️ adiada
- [ ] Multiplayer local (2 jogadores, mesmo dispositivo, tela dividida) — sem dependência de rede.
- [ ] Multiplayer online via WebSocket no Fastify (`@fastify/websocket`), sem Redis — começar por 1-2 modelos (ex.: air hockey, corrida), conforme REQUISITOS.MD §7.15.
- Adiada a pedido do usuário. Pesquisa de viabilidade já feita (ver `docs/ROADMAP.md` Fase 6): local é uma mudança coordenada mas contida (motores + interface `GameEngine` + tela Jogar, sem infra nova); online exigiria construir sincronização em tempo real do zero (sem `@fastify/websocket` nem model de partida/sala hoje) e, se for seguir a recomendação literal do REQUISITOS.MD (air hockey/corrida), também um motor de jogo novo antes de pensar em rede — decisão de escopo (usar template existente vs. criar um novo) fica pra quando a fase for retomada.

### Fase 7 — IA avançada
- [ ] Moderação de conteúdo completa via visão computacional.
- [ ] Normalização de pose do sprite (corrida/pulo animados).
- [ ] Classificação automática de elementos do desenho (sugestão, não substitui a marcação manual).
- [ ] Funcionalidades de IA do REQUISITOS.MD §7.9 (sugerir nome/descrição/capa, detectar caminho impossível, comandos em linguagem natural).
