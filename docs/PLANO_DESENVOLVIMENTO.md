# Plano de Desenvolvimento — MK Game Creator (MVP)

Documento complementar ao PRD.md. Define arquitetura técnica, sprints, cronograma, riscos e critérios de pronto para entregar o MVP de 7 telas.

## 1. Premissas
- Escopo travado em 7 telas (Splash, Home, Upload, Personagem, Gerar Jogo, Jogar, Compartilhar).
- Um único template de jogo (Plataforma).
- Meta de experiência: fluxo completo em até 60 segundos.
- Usuário final inclui crianças — exige atenção redobrada a moderação de conteúdo e privacidade.

## 2. Arquitetura técnica (conforme CLAUDE.md do projeto)

**Frontend**
- Next.js 15 + React 19 + TypeScript, TailwindCSS + shadcn/ui para os componentes de UI.
- Motor de jogo 2D: PixiJS (renderização Canvas/WebGL) + Matter.js (física de corrida, pulo e colisão) para o template de Plataforma.
- Feature-first, componentes pequenos, sem lógica de negócio na UI (conforme regras do CLAUDE.md).

**Backend**
- Fastify expondo API REST: autenticação, upload de imagem, orquestração do pipeline de IA, CRUD de "Meus Jogos", geração de link compartilhável.
- Prisma como ORM sobre PostgreSQL.
- Fila assíncrona para o pipeline de IA (upload não deve travar a UI; progresso reportado via polling ou websocket).
- Clean Architecture: camadas de domínio/casos de uso isoladas de framework e UI.

**Pipeline de IA (Passo "Gerar Jogo")**
1. Análise do desenho (validação: é um desenho de personagem? conteúdo apropriado?).
2. Remoção de fundo (modelo de segmentação, ex. rembg/SAM ou serviço gerenciado).
3. Geração/normalização do sprite (recorte, proporção, pose padrão para animação de corrida/pulo).
4. Montagem do cenário (template fixo de Plataforma com posições de moedas/obstáculos/bandeira parametrizadas).

**Infraestrutura**
- Supabase Auth para login social (Google, Microsoft) e Supabase Storage para imagens/sprites/assets.
- Observabilidade: logs do pipeline de IA e tempo de cada etapa (essencial para garantir a meta de 60s).

**Moderação e privacidade (não funcional, mas crítico)**
- Checagem automática de conteúdo impróprio na imagem antes do processamento.
- Consentimento de responsável no cadastro/login e minimização de dados coletados (LGPD / equivalente a COPPA).

## 3. Fases e sprints (sprints de 2 semanas)

### Sprint 0 — Fundação
- Escolher e validar o provedor de IA/segmentação de imagem (único item de stack ainda aberto — demais itens já definidos em docs/CLAUDE.md).
- Setup do monorepo (apps/, packages/, backend/), CI/CD, ambientes (dev/staging/prod) com Next.js 15 + Fastify.
- Configurar Supabase (Auth + Storage) e Prisma + PostgreSQL.
- Design system em Tailwind/shadcn: paleta, tipografia, componentes grandes/coloridos (estilo Nintendo/LEGO/Supercell).
- Modelagem de dados (Prisma schema): usuário, jogo, sprite, sessão de jogo, estatísticas.
- Definir contrato da API REST (Fastify) entre frontend e pipeline de IA (inputs/outputs de cada etapa).

### Sprint 1 — Splash, Login e Home
- Tela Splash (logo, proposta de valor, CTA "Começar").
- Login social Google e Microsoft.
- Home: header com avatar, botão "+ Novo Jogo", grid "Meus Jogos" com botão "▶ Jogar".
- Critério de aceite: usuário novo faz login e chega à Home em até 2 toques.

### Sprint 2 — Upload do Desenho
- Tela de upload: arraste de imagem, "Tirar Foto", "Escolher Arquivo" (PNG/JPG/HEIC).
- Integração com etapa 1-2 do pipeline (análise + remoção de fundo).
- Tela de resultado "Original vs. Resultado" com "✓ Fundo removido".
- Moderação automática de conteúdo antes de liberar o "Continuar".
- Critério de aceite: da captura da foto ao sprite exibido, tempo ≤ 15s em conexão padrão.

### Sprint 3 — Escolher Personagem e Gerar Jogo
- Tela "Escolher Personagem": opção "Meu Desenho" + galeria de personagens prontos (assets ilustrados).
- Tela "Gerar Jogo": card único "Plataforma" pré-selecionado + botão "Criar Meu Jogo".
- Animação de geração com checklist sequencial (Analisando → Removendo fundo → Criando personagem → Construindo cenário → Pronto), ligada ao status real do pipeline.
- Critério de aceite: pipeline completo (upload já feito → jogo pronto) em ≤ 45s.

### Sprint 4 — Motor do Jogo (Jogar)
- Implementação do template "Plataforma" com PixiJS (render) + Matter.js (física): corrida/pulo, colisão, obstáculos, moedas, bandeira de chegada.
- HUD: vidas (❤❤❤), contador de moedas.
- Controles touch (← → ↑) e teclado.
- Reiniciar e Tela Cheia.
- Critério de aceite: jogo roda a 60fps em dispositivo móvel de entrada (teste em Android low-end).

### Sprint 5 — Compartilhar, Polimento e QA
- Tela de vitória: estrelas, tempo, moedas, confetti.
- Ações: Compartilhar (share nativo), Copiar Link (link público do jogo), Editar, Criar Outro.
- Geração de link compartilhável (página pública para jogar sem login, se decidido no produto).
- Polimento de animações/transições em todas as 7 telas.
- QA end-to-end do fluxo completo cronometrado (meta de 60s), testes em dispositivos variados.
- Revisão de privacidade/moderação antes do lançamento.
- Critério de aceite: 8 em cada 10 crianças testadas (teste de usabilidade) completam o fluxo sem ajuda de um adulto.

## 4. Cronograma estimado
6 sprints × 2 semanas = **12 semanas (~3 meses)** do Sprint 0 ao MVP pronto para beta.

## 5. Papéis sugeridos
Product/PM, 1 designer (UI/motion), 2 devs frontend (UI + motor de jogo), 1 dev backend, 1 dev/ML para pipeline de IA, 1 QA. Pipeline de IA pode ser terceirizado via APIs gerenciadas para reduzir escopo de ML próprio no MVP.

## 6. Riscos e mitigação
- **Qualidade variável dos desenhos infantis** (traço solto, cores fora do contorno) pode quebrar a remoção de fundo → mitigar com fallback para "Personagens Prontos" sempre disponível.
- **Tempo de geração acima de 60s** quebra a promessa central do MVP → priorizar processamento assíncrono e cache de modelos, medir cada etapa desde a Sprint 0.
- **Conteúdo impróprio enviado por menores** → moderação automática obrigatória antes de qualquer processamento visível ao usuário.
- **Performance do jogo em tablets/celulares antigos** (público infantil frequentemente usa dispositivos mais simples) → testar cedo em hardware de baixo custo.
- **Dependência de login de terceiros para crianças** → validar com jurídico/produto se é necessário fluxo de consentimento do responsável.

## 7. Definição de Pronto (DoD) do MVP
- As 7 telas implementadas conforme PRD.md, com design system aplicado.
- Fluxo completo splash → jogo compartilhado testado de ponta a ponta em mobile e desktop.
- Tempo médio do fluxo medido e reportado (meta ≤ 60s).
- Moderação de conteúdo e consentimento de privacidade ativos em produção.
- Teste de usabilidade com crianças realizado, com taxa de conclusão sem ajuda ≥ 80%.

## 8. Roadmap após o MVP
Ver seção 12 do PRD.md — evolução para o fluxo "Desenhar → Animar → Jogar → Editar → Publicar", incluindo editor de fases, novos templates de jogo, criação de inimigos, mais IA generativa e comunidade de compartilhamento.
