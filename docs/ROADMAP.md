# ROADMAP — Rumo ao nível Pixicade

Este documento assume o papel do `ROADMAP.md` previsto (e ainda `⏳ pendente`) em `docs/CLAUDE.md`. Ele parte do MVP de 7 telas já entregue (`docs/PRD.md`, `docs/TASKS.md`) e planeja o que falta para o MK Game Creator chegar ao nível de produto do **Pixicade** (Abacus Brands) — a referência de mercado citada pelo time.

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

## 2. Matriz de gap — o que já temos vs. Pixicade

| Recurso | Pixicade | MK Game Creator hoje | Gap |
|---|---|---|---|
| Desenho → personagem jogável | ✅ marcador de cor fixa | ✅ upload + remoção de fundo (IA) + recorte de forma | Já equivalente (e mais flexível: não exige marcador específico) |
| Extrair moedas/obstáculos do próprio desenho | ✅ via cor do marcador | ✅ detecção de forma + criança marca o papel de cada uma | Já equivalente (abordagem diferente, mesmo resultado) |
| Tipos de jogo | 7 (plataforma, labirinto, brick breaker, paddle battle, slingshot, esportes...) | 2 (Plataforma, Labirinto) | **Grande** |
| Inimigos com comportamento (andar, perseguir, atirar) | ✅ | ❌ obstáculos são estáticos | **Grande** |
| Powerups (vida extra, escudo, moeda em dobro) | ✅ | ❌ | Médio |
| Fundos/cenário customizável (cor, tema, música) | ✅ | ❌ céu fixo, sem som nenhum | Médio |
| Som/música | ✅ | ❌ **o app não tem áudio algum hoje** | Médio |
| Avatar persistente/reutilizável | ✅ "vestir" o personagem em vários jogos | ❌ cada jogo cria um sprite novo do zero | Médio |
| Multiplayer local | ✅ (Paddle Battle, 2 jogadores) | ❌ | Médio |
| Comunidade/arcade pública (navegar jogos de outros) | ✅ | ⚠️ só link direto (`shareSlug`), sem navegação/descoberta | Médio |
| Autenticação real | Conta simples | ❌ usuário de dev fixo (login pulado desde o Sprint 1) | **Pré-requisito** de tudo que envolve "outras pessoas" |
| App instalável (loja de app / PWA) | ✅ nativo iOS/Android | ❌ só web (Next.js) | Médio |
| Moderação de conteúdo automática | Implícita (produto físico, sem foto de terceiros) | ❌ stub (Sprint 0 em aberto) | Alto — crítico antes de qualquer lançamento com público real |
| Normalização de pose do sprite (corrida/pulo) | ✅ (o próprio motor anima) | ❌ stub — sprite é estático | Baixo/Médio |

## 3. Fora de escopo intencional

- **Kit físico com marcadores e caderno de atividades**: não faz sentido para nós — somos um produto 100% digital, sem loja/logística de produto físico.
- **Convenção de cor fixa por marcador**: o Pixicade usa isso porque parte de papel físico com marcador real. Já temos algo equivalente mais flexível (detecção de forma + marcação manual pela criança), então não é um gap — é só citado aqui pra explicar por que não vamos copiar literalmente esse mecanismo.

## 4. Roadmap por fases

Isso estende a "Visão de evolução" já prevista em `docs/PRD.md` §12 (`Desenhar → Animar → Jogar → Editar → Publicar`), tornando-a concreta.

### Fase 1 — Vida no cenário (curto prazo, maior custo/benefício)
- **Som e música**: efeitos de pulo/moeda/dano/vitória + trilha de fundo em loop. Tecnicamente simples (`Howler.js` ou `<audio>` nativo), mudança de percepção de qualidade enorme.
- **Powerups**: vida extra, escudo temporário (ignora 1 hit), moeda em dobro por tempo limitado. Reaproveita o sistema de sensor/colisão do motor já existente (`platform-game.ts`) — só mais um `label` de colisão.
- **Inimigos com movimento simples**: patrulha entre dois pontos (`Matter.Body.setVelocity` alternando direção ao bater numa borda) antes de partir para IA mais sofisticada (perseguição, projéteis).
- **Fundo customizável**: escolher uma cor/tema de céu na tela "Gerar Jogo", ou (mais fiel ao pedido de "absorver o desenho") extrair a cor predominante do papel de fundo do próprio desenho.

### Fase 2 — Mais tipos de jogo
- ✅ **Arquitetura de templates plugável**: interface comum `GameEngine` (`apps/web/src/game/game-engine.ts`) implementada por `PlatformGame` e pelo novo `MazeGame`; a tela Jogar escolhe o motor dinamicamente por `Game.templateType`, sem duplicar HUD/tagging/sceneConfig.
- ✅ **Labirinto** (Maze): grade 12×7 gerada por recursive backtracker a cada partida, paredes sólidas (colisão real), movimento livre em 4 direções sem gravidade, moedas/machucas/powerups do desenho sorteados em células livres, saída no canto oposto dispara vitória. Tela "Gerar Jogo" agora tem seletor real (Plataforma/Labirinto).
- **Endless runner / corrida de obstáculos**: variação do platform-game com câmera seguindo o personagem e obstáculos gerados proceduralmente.
- **Paddle Battle (2 jogadores local)**: primeiro passo de multiplayer, sem precisar de rede — mesma tela, split de controles (teclado dividido ou dois conjuntos de botões touch).

### Fase 3 — Comunidade e avatar persistente
- **Pré-requisito**: autenticação real (Supabase Auth, já no stack conforme `docs/CLAUDE.md`) — hoje todo jogo pertence a um usuário de desenvolvimento fixo (`dev@local`); nada de "comunidade" faz sentido sem contas reais.
- **Avatar persistente**: permitir escolher um personagem já usado antes em vez de sempre recomeçar do upload — o modelo `Sprite` do Prisma já suporta isso (`Sprite.games: Game[]`, um sprite pode pertencer a vários jogos); falta só a tela de "Meus Personagens".
- **Arcade pública**: uma tela de navegação (`/arcade` ou `/explorar`) listando jogos marcados como públicos por outros usuários, com jogatina direta — hoje só existe o link direto por `shareSlug`.
- Perfis simples, curtir/favoritar jogos de outros.

### Fase 4 — Multiplayer online e app instalável
- **Multiplayer online**: WebSocket (ex.: `socket.io` ou o WebSocket nativo do Fastify) para Paddle Battle ou corrida entre 2 jogadores remotos — bem mais complexo que o multiplayer local da Fase 2 (sincronização de estado, latência).
- **PWA instalável**: manifest + service worker no Next.js (suporte nativo do App Router) para a criança poder "instalar" o app na tela inicial — passo intermediário barato antes de cogitar um wrapper nativo (Capacitor/Expo) se algum dia for pra loja de apps de verdade.

### Fase 5 — IA de verdade (depende do Sprint 0 escolher provedor)
- **Moderação de conteúdo real**: crítico antes de qualquer lançamento com usuários de verdade (crianças enviando fotos). Continua bloqueado até decidir provedor (item aberto desde o Sprint 0).
- **Normalização de pose** (corrida/pulo do sprite): hoje o personagem é uma imagem estática; um pipeline de IA poderia gerar variações de pose ou pelo menos um leve "squash and stretch" procedural sem IA como atalho mais barato.
- **Classificação automática de elementos do desenho**: hoje a criança marca manualmente cada forma (Personagem/Moeda/Pular/Machuca) — poderia usar uma API de visão (com custo e credenciais) para sugerir a marcação automaticamente, mantendo a confirmação manual como estava.

## 5. Recomendação de por onde começar

A Fase 1 (som, powerups, inimigo com movimento simples, fundo customizável) é o maior salto de percepção de qualidade pelo menor esforço técnico — tudo reaproveita a arquitetura já construída (`platform-game.ts`, `sceneConfig`) sem exigir autenticação real, rede ou novos templates. Recomendo priorizar essa fase antes de partir para mais tipos de jogo ou comunidade.
