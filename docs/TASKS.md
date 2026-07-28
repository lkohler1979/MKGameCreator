# TASKS — MK Game Creator (MVP, 7 telas)

Referência: PRD.md e PLANO_DESENVOLVIMENTO.md. Sprints de 2 semanas.

## Sprint 0 — Fundação
- [ ] Escolher e validar o provedor de IA/segmentação de imagem (demais itens de stack já definidos em docs/CLAUDE.md: Next.js 15, React 19, TypeScript, Tailwind/shadcn, PixiJS+Matter.js, Fastify, Prisma, PostgreSQL, Supabase Auth/Storage).
- [ ] Setup do monorepo (apps/, packages/, backend/), CI/CD, ambientes (dev/staging/prod).
- [ ] Configurar Supabase Auth/Storage e Prisma + PostgreSQL.
- [ ] Design system em Tailwind/shadcn: paleta, tipografia, componentes grandes/coloridos (estilo Nintendo/LEGO/Supercell).
- [ ] Modelagem de dados (Prisma schema): usuário, jogo, sprite, sessão de jogo, estatísticas.
- [ ] Definir contrato da API REST (Fastify) entre frontend e pipeline de IA.
- [ ] Definir estratégia de moderação de conteúdo e conformidade LGPD/consentimento de responsável.

## Sprint 1 — Splash, Login e Home
- [ ] Tela Splash: logo, proposta de valor, CTA "Começar".
- [ ] Login social Google.
- [ ] Login social Microsoft.
- [ ] Home: header com avatar/perfil.
- [ ] Home: botão de destaque "+ Novo Jogo".
- [ ] Home: grid "Meus Jogos" (nome + botão "▶ Jogar").
- [ ] Teste de usabilidade: login → Home em até 2 toques.

## Sprint 2 — Upload do Desenho
- [ ] Tela de upload: área de arraste da imagem.
- [ ] Opção "Tirar Foto" (câmera).
- [ ] Opção "Escolher Arquivo" (PNG/JPG/HEIC) + validação de formato/tamanho.
- [ ] Integração: etapa de análise do desenho (pipeline de IA).
- [ ] Integração: etapa de remoção de fundo (pipeline de IA).
- [ ] Moderação automática de conteúdo antes de liberar o "Continuar".
- [ ] Tela de resultado "Original vs. Resultado" com "✓ Fundo removido".
- [ ] Medir e otimizar tempo dessa etapa (meta ≤ 15s).

## Sprint 3 — Escolher Personagem e Gerar Jogo
- [ ] Tela "Escolher Personagem": opção "Meu Desenho" selecionável.
- [ ] Galeria de personagens prontos (produzir/ilustrar assets: robô, dinossauro, astronauta, ninja, gato, sapo, fantasma, macaco).
- [ ] Tela "Gerar Jogo": card único "Plataforma" pré-selecionado.
- [ ] Botão "Criar Meu Jogo" disparando o pipeline completo.
- [ ] Tela de animação de progresso (checklist: Analisando → Removendo fundo → Criando personagem → Construindo cenário → Pronto) ligada ao status real do backend.
- [ ] Integração: geração/normalização do sprite (pose padrão de corrida/pulo).
- [ ] Integração: montagem do cenário do template de Plataforma.
- [ ] Medir e otimizar tempo do pipeline completo (meta ≤ 45s).

## Sprint 4 — Motor do Jogo (Jogar)
- [ ] Setup do motor de jogo (PixiJS para render + Matter.js para física) e template "Plataforma".
- [ ] Física de corrida e pulo, colisão com plataformas e obstáculos.
- [ ] Moedas coletáveis e bandeira de chegada.
- [ ] HUD: vidas (❤❤❤) e contador de moedas.
- [ ] Controles touch (← → ↑) e teclado.
- [ ] Botões "Reiniciar" e "Tela Cheia".
- [ ] Teste de performance em dispositivo Android de entrada (meta 60fps).

## Sprint 5 — Compartilhar, Polimento e QA
- [ ] Tela de vitória: estrelas, tempo, moedas, animação de confetti.
- [ ] Ação "Compartilhar" (share nativo).
- [ ] Ação "Copiar Link" (link público do jogo).
- [ ] Ação "Editar" (retorna ao fluxo com dados existentes).
- [ ] Ação "Criar Outro" (reinicia o fluxo).
- [ ] Polimento de transições/animações nas 7 telas.
- [ ] QA end-to-end cronometrado do fluxo completo (meta ≤ 60s).
- [ ] Teste de usabilidade com crianças (meta: 80% completam sem ajuda de adulto).
- [ ] Revisão final de moderação de conteúdo e privacidade antes do lançamento beta.

## Backlog pós-MVP
- [ ] Fluxo "Desenhar" (desenhar direto no app, sem upload).
- [ ] Fluxo "Animar" (animações customizadas do personagem).
- [ ] Editor visual de fases/cenário.
- [ ] Criação de inimigos.
- [ ] Novos templates de jogo além de Plataforma.
- [ ] IA generativa para cenários variados.
- [ ] Comunidade: publicar e jogar criações de outros usuários.
