# ROADMAP — Rumo ao nível Pixicade e ao docs/REQUISITOS.MD

Este documento assume o papel do `ROADMAP.md` previsto em `docs/CLAUDE.md`. Parte do MVP de 7 telas já entregue (`docs/PRD.md`, `docs/TASKS.md`) e do que foi construído nas Fases 1-3 (som/powerups/inimigos, templates plugáveis + Labirinto, autenticação real + avatar persistente).

**`docs/REQUISITOS.MD` é hoje a fonte mais completa e autoritativa da visão de produto** — descreve uma plataforma bem maior do que o MVP original (perfil infantil, sistema de cores/comportamentos, editor visual, ranking, comunidade, multiplayer, área escolar/responsável, monetização). Este roadmap incorpora essa visão sem descartar o que já existe: tudo abaixo foi sequenciado para que cada fase seja aditiva sobre a anterior, nunca uma reescrita destrutiva.

> **Decisão de stack (confirmada com o time)**: `REQUISITOS.MD` sugere (§11) um backend em NestJS, Redis, storage S3 e app mobile nativo (React Native/Flutter). Decisão tomada: **manter PostgreSQL e o backend atual (Fastify) como estão** — não há migração de arquitetura planejada. "Funcionar no celular" significa a *web app* (Next.js) funcionar bem em navegadores móveis (responsivo, touch-friendly), não um app nativo instalável. Ver §5 para o que isso muda no sequenciamento das fases.

## 1. O que é o Pixicade, de fato

Pesquisei o produto para não planejar em cima de suposição. Resumo, com fontes:

- **Kit físico + app**: vem com marcadores laváveis coloridos e um caderno de atividades; a criança desenha no papel e fotografa com o app (grátis, iOS/Android).
- **Convenção de cores**: cada marcador tem uma função fixa — uma cor é sempre "personagem", outra é "obstáculo/perigo", outra é "objeto móvel", etc. É assim que o reconhecimento funciona de forma confiável, sem precisar de IA de verdade: a cor *é* o rótulo.
- **7 tipos de jogo**: plataforma, labirinto, brick breaker (quebra-bloco), "paddle battle" (multiplayer local, tipo pong), slingshot, esportes, entre outros.
- **Inimigos com comportamento**: andam, pulam, giram, atiram projéteis — não são só obstáculos parados.
- **Fundo, música e cosméticos**: biblioteca de assets prontos (fundos, trilhas, molduras) + opção de desenhar os próprios.
- **Avatar persistente**: o personagem pode ser "vestido"/reutilizado em vários jogos, não é recriado do zero a cada vez.
- **Multiplayer local** (2 jogadores) em modos como Paddle Battle.
- **Comunidade**: jogos podem ser compartilhados publicamente e jogados por outras pessoas numa "arcade"/loja de jogos dentro do app.
- **Modelo de negócio**: kit físico pago (~US$25-30), app grátis.

Fontes: [Abacus Brands — página do produto](https://www.abacusbrands.com/products/pixicade), [The Toy Insider — review](https://thetoyinsider.com/pixicade-instant-game-maker-review/), [Amazon — listagem do produto](https://us.amazon.com/Abacus-Brands-Pixicade-Drawings-Playable/dp/B0FMN9GHDD), [Daylight DC — review do app](https://daylightdc.com/pixicade-mobile-game-maker/).

## 2. Matriz de gap — Pixicade

| Recurso | Pixicade | MK Game Creator hoje | Gap |
|---|---|---|---|
| Desenho → personagem jogável | ✅ marcador de cor fixa | ✅ upload + remoção de fundo (IA) + recorte de forma | Já equivalente (e mais flexível: não exige marcador específico) |
| Extrair moedas/obstáculos do próprio desenho | ✅ via cor do marcador | ✅ detecção de forma + criança marca o papel de cada uma | Já equivalente (abordagem diferente, mesmo resultado) |
| Tipos de jogo | 7 (plataforma, labirinto, brick breaker, paddle battle, slingshot, esportes...) | 2 (Plataforma, Labirinto) | **Grande** |
| Inimigos com comportamento (andar, perseguir, atirar) | ✅ | ❌ obstáculos são estáticos | **Grande** |
| Powerups (vida extra, escudo, moeda em dobro) | ✅ | ✅ (Fase 1) | Resolvido |
| Fundos/cenário customizável (cor, tema, música) | ✅ | ✅ cor do céu extraída do desenho (Fase 1); música/temas prontos ainda não | Médio |
| Som/música | ✅ | ✅ efeitos + trilha sintetizados (Fase 1) | Resolvido |
| Avatar persistente/reutilizável | ✅ "vestir" o personagem em vários jogos | ✅ tela "Meus Personagens" reaproveita um `Sprite` já criado (Fase 3) | Resolvido |
| Multiplayer local | ✅ (Paddle Battle, 2 jogadores) | ❌ | Médio |
| Comunidade/arcade pública (navegar jogos de outros) | ✅ | ⚠️ só link direto (`shareSlug`), sem navegação/descoberta | Médio |
| Autenticação real | Conta simples | ✅ e-mail+senha (sessão via cookie, Fase 3); login social ainda não | Resolvido (OAuth fica pra quando houver credenciais Google/Microsoft) |
| App instalável (loja de app / PWA) | ✅ nativo iOS/Android | ❌ só web (Next.js) | Sem plano de app nativo (decisão confirmada) — web responsiva cobre o uso em celular; PWA instalável fica como opção barata se um dia fizer sentido |
| Moderação de conteúdo automática | Implícita (produto físico, sem foto de terceiros) | ❌ stub | Alto — crítico antes de qualquer lançamento com público real |
| Normalização de pose do sprite (corrida/pulo) | ✅ (o próprio motor anima) | ❌ stub — sprite é estático | Baixo/Médio |

## 3. Matriz de gap — docs/REQUISITOS.MD (itens do MVP, §14)

| Item do MVP (REQUISITOS.MD §14) | Status | Observação |
|---|---|---|
| Cadastro e login | ✅ | E-mail+senha, sessão via cookie httpOnly (Fase 3). Google/Apple ainda não. |
| Criação de perfil infantil | ❌ | Não existe idade/responsável no `User` hoje. |
| Seleção de modelo de jogo | ⚠️ (2 de ~11) | Plataforma + Labirinto; o arquivo cita até 11 modelos (corrida, coleta de itens, quebra-blocos, air hockey, futebol, aventura, puzzle...). |
| Captura de desenho pela câmera | ✅ (parcial) | Já tem "Tirar Foto" + rotação + escolher arquivo. Faltam: detecção de borda da folha, correção de perspectiva, remoção de sombra, grade de alinhamento, alerta de imagem desfocada. |
| Reconhecimento de cores | ⚠️ (ver nota) | Ver "Nota sobre o sistema de cores" abaixo. |
| Conversão em jogo 2D / personagem / plataformas / obstáculos / moedas / ponto final | ✅ | |
| Editor básico (mover, redimensionar, excluir, reposicionar) | ✅ | `new-game/edit` — resolvido na Fase 4.2. |
| Execução do jogo | ✅ | |
| Salvamento | ✅ | |
| Compartilhamento por link | ✅ | |
| Ranking de pontuação | ❌ | `GameSession` já grava pontuação/tempo/vidas, mas não existe tela nem consulta de ranking. |
| Biblioteca de jogos | ⚠️ | "Meus Jogos" existe; falta categorização (em desenvolvimento/publicado/privado/favorito/compartilhado/excluído/recente). |
| Comunidade básica | ❌ | Só link direto — sem área de descoberta. |
| Controle parental mínimo | ❌ | Não existe. |

**Nota sobre o sistema de cores**: o próprio `REQUISITOS.MD`, na seção final ("Sistema Inteligente (Recomendado)"), recomenda exatamente a abordagem que já implementamos — "separar os conceitos de cor e categoria... o usuário confirma ou altera a categoria de cada objeto... a categoria define o comportamento". Isso é literalmente `shape-detection.ts` (detecção de forma agnóstica de cor) + a tela de marcação + `element-roles.ts` → `scene-config-builder.ts` (categoria → comportamento). **Não é um gap arquitetural, é um gap de quantidade de categorias**: hoje temos 6 papéis (Personagem/Moeda/Pular/Machuca/Powerup/Ignorar) contra um vocabulário bem mais rico no arquivo (Plataforma, Item, Perigo, Spawn, Objetivo, Objeto Dinâmico, Inimigo, NPC, Portal, Power-up, Bloco destrutível, Física...). Fechar esse gap é extensão incremental do mecanismo existente, não redesenho.

- ✅ **Configuração de cores** (`/configuracoes/cores`, `User.colorRoleMap`): a tabela "Cores Base" do `REQUISITOS.MD` (§ Sistema de Cores) inspirou um mapa cor→categoria configurável por usuário — cada forma detectada tem sua cor média amostrada (`sampleShapeColor`) e comparada ao mapa salvo (`matchColorToRole`, distância euclidiana em RGB com limiar tolerante), pré-selecionando a categoria mais provável na tela de marcação em vez do `"moeda"` fixo de antes. A criança continua confirmando/trocando cada marcação normalmente — isso só muda o valor inicial. Adaptações em relação à tabela original: Branco/Power-up não é viável (nosso pipeline assume papel branco como fundo, então um elemento branco nunca seria detectado como forma separada — Ciano foi reaproveitado no lugar); Verde/Spawn e Amarelo/Objetivo ficaram de fora (personagem é auto-detectado pela maior forma, não por cor; não existe "marcar objetivo" via tagging); Rosa/NPC e Ciano/Portal (original) não têm papel hoje (adiados na Fase 4.1). Mapa default com 8 cores.

## 4. Fora de escopo intencional (não muda)

- **Kit físico com marcadores e caderno de atividades**: não faz sentido para nós — produto 100% digital, sem loja/logística de produto físico.
- **Convenção de cor fixa por marcador**: já temos o equivalente mais flexível (ver nota acima) — não é um gap, só é citado para explicar por que não copiamos esse mecanismo literalmente.
- Tudo que o próprio `REQUISITOS.MD` já marca como "Fora do MVP" (§14) ou "Segunda fase" (§15): marketplace, chat livre entre crianças, licenciamento de marcas, realidade aumentada, criação colaborativa em tempo real, competições/torneios.

## 5. Roadmap por fases

Fases 1-3 já entregues (som/powerups/inimigos com patrulha, arquitetura de templates + Labirinto, autenticação real + avatar persistente). Sem migração de arquitetura no plano (ver decisão de stack acima) — todas as fases abaixo rodam sobre PostgreSQL + Fastify + Next.js.

### Fase 1 — Vida no cenário ✅ concluída
Som/música sintetizados, powerups, inimigos com patrulha simples, cor de céu extraída do desenho.

### Fase 2 — Mais tipos de jogo ✅ parcialmente concluída
- ✅ Arquitetura de templates plugável (`GameEngine`) + template Labirinto.
- Pendente (fica pra quando entrarmos nos novos modelos da Fase 4.1): Corrida, Coleta de Itens, Quebra-blocos, Air Hockey — ver Fase 4.1 abaixo, que já teria a base de categorias pronta pra isso.

### Fase 3 — Autenticação e avatar persistente ✅ concluída
E-mail+senha com sessão via cookie, avatar persistente ("Meus Personagens"). Pendente: login social (Google/Microsoft/Apple), arcade pública (absorvida pela Fase 4.6 "Comunidade básica" abaixo).

### Fase 4 — Fechar o MVP conforme docs/REQUISITOS.MD (sobre a stack atual)
Tudo aqui é aditivo sobre o que já existe — nenhum item exige tocar no motor de jogo, no pipeline de upload ou na autenticação já entregues.

- ✅ **4.1 Mais categorias de objeto (Behavior Engine incremental)**: `ElementRole` ganhou `inimigo` (persegue o jogador dentro de um raio, mais lento que ele pra dar pra fugir), `destrutivel` (some ao tocar) e `dinamico` (sólido, patrulha como o hazard). Na Plataforma os 3 têm comportamento real; no Labirinto `destrutivel` funciona igual, `inimigo`/`dinamico` degradam pra hazard/hop (perseguir pelas paredes exigiria pathfinding, fora de escopo). Novo template **Coleta de Itens** (`collect-game.ts`): arena aberta, cronômetro regressivo de 60s, vitória ao coletar todas as moedas. Portal/teleporte e NPC com diálogo ficaram de fora desta rodada (dependem de UI de pareamento e sistema de diálogo, respectivamente, nenhum dos dois existe ainda).
- ✅ **4.2 Editor básico**: `apps/web/src/app/new-game/edit/page.tsx` — mover/redimensionar/trocar tipo/excluir/adicionar moeda/obstáculo/powerup. Plataforma ganha editor visual com arraste (só ela usa x/y/width/height de verdade); Labirinto/Coleta de Itens ganham uma lista simples (contagem+tipo, já que os dois motores reamostram posição a cada partida). Dois pontos de entrada: durante a criação (botão "Editar Cenário" no Generate, opera em cima do `sceneConfig` pendente em `sessionStorage`) e num jogo já salvo (botão "Editar" da tela de vitória, agora carrega o cenário real via `GET /games/:id` e salva via `PATCH /games/:id` estendido para aceitar `sceneConfig`). Fora de escopo (fica pro "editor avançado" do REQUISITOS.MD §15): girar, duplicar, agrupar, camadas, bloquear objeto, propriedades físicas avançadas.
- ✅ **4.3 Ranking de pontuação**: `GET /games/:id/ranking` (público, top 10 sessões concluídas por moedas desc/tempo asc) + painel de troféu na tela Jogar.
- ✅ **4.4 Biblioteca de jogos com categorias**: abas Todos/Públicos/Privados/Favoritos na Home; `Game.visibility` (PRIVATE/PUBLIC, toggle por card) e model `Favorite` novos. Deixei de fora "em desenvolvimento"/"excluídos"/"recentes" do REQUISITOS.MD por não terem estado real no modelo de dados hoje (não há rascunho de jogo nem soft-delete; "recentes" é redundante com a ordenação padrão).
- ⏸️ **4.5 Perfil infantil + controle parental mínimo**: adiada a pedido do usuário — envolve decisões de produto/legais ainda em aberto (limite de idade pra exigir consentimento, como a criança vincula um responsável já que `responsavelId` é FK pra `User` e não um e-mail solto, o que "revogar acesso" deve fazer). Fica pra uma rodada futura com essas decisões fechadas.
- ✅ **4.7 Moderação mínima**: filtro de nome impróprio (`backend/src/lib/content-filter.ts`) aplicado na criação do jogo (único texto livre hoje, sem campo de descrição) — aprovação automática + denúncia, a alternativa que o próprio `REQUISITOS.MD` permite em vez de fila manual. Model `GameReport` novo (`POST /games/:id/report`) persiste denúncias pra revisão manual futura; sem fila/admin UI ainda.
- ✅ **4.6 Comunidade básica**: tela `/comunidade` listando jogos públicos de todos os usuários (`GET /games/community`). Curtidas reaproveitam 100% o model `Favorite` da Fase 4.4 (favoritar o jogo de outra pessoa já era suportado pela rota, só nunca exposto na UI) — sem chat livre, conforme recomendação do próprio REQUISITOS.MD §7.19.

### Fase 5 — Web funcionando bem em celular (sem app nativo)
Não é uma reescrita — é auditoria + ajustes sobre o que já existe. O PRD já previa "mobile-first" como princípio de design (§8); esta fase garante que isso realmente se sustenta, inclusive nas telas novas da Fase 4.
- ✅ **Auditoria de responsividade** em viewport emulado (375×812 e 320×568) em todas as telas (Splash/Login/Signup, Home, Comunidade, assistente de criação completo, Editor — os dois sub-modos, Jogar — os 3 templates): nenhuma tela ficou com overflow horizontal ou elemento inacessível atrás da navegação inferior fixa.
  - **Achado real corrigido**: a área de jogo (`play/[id]/page.tsx`) usava `aspect-[25/14] w-full`, que sempre resolve pela largura — numa tela alta e estreita (celular em retrato) isso deixava o canvas minúsculo (uma faixa horizontal fina, com muito espaço vazio acima/abaixo). Trocado por um cálculo real via `ResizeObserver` que ajusta ao eixo mais restritivo (largura OU altura, o que for menor), preservando o comportamento em desktop (testado: 896×501 em 1280px de largura, igual ao `max-w-4xl` anterior) e melhorando o aproveitamento em outras proporções de tela.
  - **Achado real corrigido**: elementos arrastáveis do Editor (`new-game/edit/page.tsx`) não tinham `touch-action: none` — em toque real, o navegador pode interpretar o gesto inicial como rolagem da página antes do JS capturar o ponteiro. Adicionado `touch-none` nos elementos arrastáveis e na alça de redimensionar (que também ganhou um alvo de toque maior, de 14px para 24px).
  - Adicionado um aviso leve ("Gire o celular para uma tela maior") em telas pequenas e em retrato na tela Jogar — não bloqueia nada, só orienta, já que os templates atuais são desenhados em paisagem (25:14).
- ✅ **Controles touch da tela Jogar validados** (tamanho e posicionamento): cruz direcional 48×48px, botões de mover/pular 56-64px, reiniciar/tela cheia 40px — todos dentro ou próximos do mínimo recomendado (~44px), sem sobreposição em 375px de largura.
- ⚠️ **Limitação desta rodada**: a auditoria acima rodou em viewport emulado (redimensionamento de janela), não em hardware real — o próprio item pede validação "em dispositivo móvel real", que este ambiente não tem como fazer. Comportamentos que só aparecem em toque físico de verdade (ex.: gestos do sistema operacional, teclado virtual sobrepondo campos, orientação real do acelerômetro) continuam pendentes de um teste manual num Android/iOS real antes de qualquer lançamento.
- ⏸️ **Captura de foto** (`capture="environment"`) — não validado nesta rodada; precisa de câmera física real (Android e iOS), que este ambiente não tem.
- ✅ **PWA leve**: `app/manifest.ts` (nome, ícones, `display: standalone`, cor de tema) + ícones gerados via `next/og` (`ImageResponse`) reaproveitando a identidade visual existente (gradiente `#241454→#5b3fd9` + "MK" em `#ffc736`, mesma paleta da Splash/Login) — sem precisar de nenhum arquivo de imagem novo no repo. Deixa a criança "instalar" o atalho na tela inicial (Android/desktop via prompt do Chrome; iOS via "Adicionar à Tela de Início" no Safari, usando o `apple-touch-icon`).

### Fase 6 — Multiplayer local e online ⏸️ adiada
- **Multiplayer local** (2 jogadores no mesmo dispositivo, tela dividida): mesma sessão de motor de jogo, dois conjuntos de controles — não depende de rede. Pesquisa de viabilidade já feita (ver notas abaixo); implementação adiada a pedido do usuário.
- **Multiplayer online**: WebSocket direto no Fastify (`@fastify/websocket`, sem precisar de Redis nesse volume) para sincronizar estado entre jogadores. O próprio `REQUISITOS.MD` (§7.15) recomenda começar por "air hockey"/"corrida" — nenhum dos dois existe hoje (só Plataforma/Labirinto/Coleta de Itens), então isso exigiria desenhar um motor de jogo novo do zero antes mesmo de pensar em rede, escopo bem maior que "multiplayer" em si. Adiada a pedido do usuário; quando retomada, decidir entre aplicar a um template já existente (ex.: Coleta de Itens, mais viável — só precisa sincronizar placar/posição aproximada, não física quadro-a-quadro) ou assumir o projeto à parte de criar um template novo.
- **Notas de viabilidade** (da pesquisa feita antes de adiar): os 3 motores (`platform-game.ts`/`maze-game.ts`/`collect-game.ts`) já leem a intenção de movimento a cada tick (não aplicam impulso direto no keypress), o que tornaria um segundo corpo/sprite controlável mecanicamente simples por motor — mas a interface `GameEngine` (`game-engine.ts`), o rótulo `"player"` fixo em `handleCollision`, os campos escalares de HUD (`coins`/`lives`, sem índice de jogador) e a tela Jogar (input/HUD) são todos desenhados pra um único jogador — mudança coordenada em vários arquivos, não um "encaixe" pontual. Para multiplayer online, hoje não existe nenhuma infraestrutura de tempo real (`@fastify/websocket` não é dependência, sem precedente de WebSocket/SSE/polling no repo) nem um model de "partida"/"sala" no schema — seria construído do zero.

### Fase 7 — IA avançada
- Moderação de conteúdo completa via visão computacional (evolução da moderação mínima da Fase 4.7).
- Normalização de pose do sprite (corrida/pulo animados em vez de sprite estático).
- Classificação automática de elementos do desenho (sugerir a categoria em vez de só detectar a forma) — reaproveita a mesma UI de marcação manual como confirmação, não substitui.
- Funcionalidades de IA do §7.9 do REQUISITOS.MD: sugerir nome/descrição/capa do jogo, detectar caminho impossível, recomendar dificuldade, comandos em linguagem natural ("deixe este inimigo mais rápido").

## 6. Fora de escopo por enquanto

Itens do `REQUISITOS.MD` que ficam de fora de todas as fases acima, por serem "Fora do MVP"/"Segunda fase" segundo o próprio arquivo (§14/§15) ou por dependerem de decisão já tomada:
- Migração de arquitetura (NestJS, Redis, storage S3-compatível) e app mobile nativo (React Native/Flutter) — decisão confirmada de manter PostgreSQL + Fastify + web responsiva (ver nota no topo deste documento). Revisitar só se surgir necessidade concreta (ex.: volume de estado de partida que o Postgres não aguente mais).
- Monetização (planos, assinaturas, códigos de ativação vinculados a kit físico).
- Área escolar completa (turmas, professores, relatórios educacionais) e trilhas educacionais/gamificação completa.
- Licenciamento de marcas, realidade aumentada, marketplace, chat livre entre crianças.

## 7. Recomendação de por onde começar

Comece pela **Fase 4** (fechar o MVP do REQUISITOS.MD sobre a stack atual) — são os itens de maior valor de produto por menor esforço. Dentro da Fase 4, sugiro esta ordem: **4.3 (ranking) → 4.4 (biblioteca com categorias) → 4.1 (mais categorias de objeto) → 4.2 (editor básico) → 4.5 (perfil infantil/parental) → 4.7 (moderação mínima) → 4.6 (comunidade)** — dos mais baratos/isolados para os que dependem de mais peças já prontas. A Fase 5 (mobile) pode rodar em paralelo ou logo em seguida, já que é auditoria/ajuste, não construção de feature nova.
