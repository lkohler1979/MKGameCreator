# PRD — MK Game Creator (MVP)

## 1. Visão geral
App que transforma o desenho de uma criança em um jogo 2D jogável em menos de 60 segundos, sem exigir nenhuma explicação prévia de uso. É a porta de entrada de um produto que, no futuro, evolui para um estúdio completo de criação infantil (Desenhar → Animar → Jogar → Editar → Publicar).

## 2. Objetivo do MVP
Entregar a experiência "uau": uma criança de 8 anos consegue, sozinha, fotografar um desenho e ver um jogo funcionando com aquele personagem em menos de um minuto. Validar esse loop mágico antes de investir em qualquer funcionalidade adicional.

## 3. Público-alvo
Crianças (a partir de ~7 anos, com apoio de um responsável no onboarding/login) e famílias. Também serve educadores e usuários casuais.

## 4. Princípio de design do MVP
Escopo fechado em **7 telas**, uma decisão por tela, elementos grandes e coloridos, zero texto explicativo necessário para avançar.

## 5. Fluxo do MVP

```
Splash → Home → Upload do Desenho → Escolher Personagem → Gerar Jogo → Jogar → Compartilhar
```

## 6. Telas e funcionalidades

### 6.1 Splash
Objetivo: transmitir a proposta em 1 olhar.
- Logo "MK Game Creator" + ilustração "desenho → jogo".
- Frase de valor: "Transforme qualquer desenho em um jogo".
- CTA "Começar".
- Login social: Google e Microsoft.

### 6.2 Home
Objetivo: o usuário enxerga só o essencial.
- Header: logo + avatar/perfil.
- Botão de destaque único: "+ Novo Jogo".
- Seção "Meus Jogos": cards com nome do jogo e botão "▶ Jogar".

### 6.3 Upload do Desenho (Passo 1 de 4)
A tela mais importante do sistema.
- Área de arraste da imagem ("Arraste sua imagem aqui").
- Alternativas: "📷 Tirar Foto" e "📁 Escolher Arquivo".
- Formatos aceitos: PNG, JPG, HEIC.
- Botão "Próximo".
- **Resultado pós-upload** (mesma tela/etapa): comparação lado a lado "Original" vs. "Resultado" (sprite), com confirmação "✓ Fundo removido" e botão "Continuar". Esse retorno visual imediato é o que gera o efeito "uau" inicial.

### 6.4 Escolher Personagem (Passo 2 de 4)
- Opção "⭐ Meu Desenho": usa o sprite gerado a partir do upload.
- Galeria "Personagens" prontos (ex.: robô, dinossauro, astronauta, ninja, gato, sapo, fantasma, macaco) como alternativa rápida.
- Seleção única. Botão "Próximo".

### 6.5 Gerar Jogo (Passo 3 de 4)
- Escolha do tipo de jogo: no MVP, **apenas um template — "Plataforma"** ("Seu personagem correrá até a chegada."), já vem selecionado.
- Botão "Criar Meu Jogo" dispara o pipeline de IA.
- **Animação de geração** (reforça a sensação de "mágica"):
  1. Analisando desenho...
  2. Removendo fundo...
  3. Criando personagem...
  4. Construindo cenário...
  5. "Seu jogo está pronto!"
- Cada etapa mostra uma barra de progresso própria preenchendo em sequência.

### 6.6 Jogar
- Maior área da tela dedicada ao gameplay (o restante da interface é mínimo).
- HUD: vidas (❤❤❤) e contador de moedas.
- Cenário de plataforma: chão, obstáculos, moeda(s), bandeira de chegada.
- Personagem controlável com física simples de corrida e pulo.
- Controles: ← → (mover) e ↑ (pular).
- Ações secundárias: "Reiniciar" e "Tela Cheia".

### 6.7 Compartilhar (Vitória)
Objetivo: incentivar o compartilhamento e o retorno ao app.
- 🎉 "Parabéns! Você criou seu primeiro jogo."
- Avaliação em estrelas (★★★★★).
- Estatísticas: Tempo (ex. 00:48) e Moedas (ex. 15).
- Ações: "Compartilhar", "Copiar Link", "Editar", "Criar Outro".

## 7. Arquitetura visual

**Desktop**
```
┌───────────────────────────────────────────┐
│ Logo                              Perfil  │
├───────────────────────────────────────────┤
│                                           │
│            Conteúdo Principal             │
│                                           │
├───────────────────────────────────────────┤
│ Ajuda   Sobre   Política   Contato        │
└───────────────────────────────────────────┘
```

**Mobile**
```
┌──────────────┐
│ MKGameCreator│
├──────────────┤
│              │
│  Conteúdo    │
│              │
├──────────────┤
│ Home  Jogos  │
└──────────────┘
```

## 8. Conceito visual
Estilo inspirado em Nintendo, LEGO e Supercell: elementos grandes, coloridos, alto contraste, poucas decisões por tela, sem densidade de informação. Animações suaves e recompensadoras (loading, confetti na vitória, transição do "Fundo removido") reforçam a sensação de "mágica" durante toda a jornada, não só no resultado final.

## 9. Requisitos não funcionais
- Tempo total do fluxo (upload → jogo pronto) alvo: **até 60 segundos**.
- Pipeline de IA: detecção do desenho, remoção de fundo, geração de sprite, montagem do cenário de plataforma — com feedback de progresso visível em cada etapa.
- Usabilidade "zero explicação": nenhuma tela deve exigir texto de ajuda para uma criança avançar.
- Design mobile-first, responsivo a desktop (ver arquitetura visual).
- Autenticação OAuth (Google/Microsoft), com fluxo simplificado pensando em uso por menores.
- **Segurança e moderação de conteúdo**: como o upload é feito por crianças, é necessário moderação automática de imagens impróprias antes de processar o desenho.
- **Privacidade infantil**: conformidade com LGPD e boas práticas equivalentes ao COPPA (consentimento de responsável, minimização de dados coletados de menores).
- Armazenamento e listagem dos jogos criados por usuário ("Meus Jogos").

## 10. Fora de escopo (MVP)
- Mais de um template de jogo (outros tipos ficam para depois do MVP).
- Editor de fases/cenário.
- Multiplayer.
- Fluxo completo "Desenhar → Animar → Jogar → Editar → Publicar" (visão de produto, não do MVP).
- Páginas institucionais completas (Ajuda, Sobre, Política, Contato) além de links no rodapé desktop.

## 11. Métricas de sucesso do MVP
- % de usuários que completam o fluxo splash → jogo jogável.
- Tempo médio real do fluxo completo (meta: ≤ 60s).
- % de jogos compartilhados após a tela de vitória.
- Taxa de retorno para criar um segundo jogo.
- Taxa de abandono por etapa (upload, personagem, geração, jogo) — indica onde simplificar ainda mais.

## 12. Visão de evolução (pós-MVP)
Depois de validado o "uau" do MVP, o produto evolui de gerador de jogos para **estúdio de criação infantil**, com o fluxo:

```
Desenhar → Animar → Jogar → Editar → Publicar
```

Direções futuras: editor visual de fases, criação de inimigos, mais templates de jogo, IA generativa para cenários variados, comunidade para compartilhar e jogar criações de outros usuários. Essa visão deve orientar decisões de arquitetura desde o MVP (ex.: dados/assets modelados de forma extensível), mesmo sem implementar essas funcionalidades agora.
