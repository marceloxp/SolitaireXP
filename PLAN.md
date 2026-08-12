# PLAN.md — Paciência (Klondike) Windows 3.1 Clone (GSAP / HTML / CSS / JS / PWA)

## Objetivo

Desenvolver um clone fiel do jogo Paciência (Klondike) do Windows 3.1, como PWA
(Progressive Web App), funcionando em Android e iPhone via navegador/tela de
início, usando HTML/CSS/JavaScript vanilla + GSAP para animação e drag-and-drop.
Prioridade: fidelidade às regras e ao comportamento clássico, código simples e
direto, sem framework desnecessário.

Desenvolva o projeto completo de ponta a ponta, sem pausar para confirmação a cada
etapa, exceto onde este documento pedir explicitamente uma decisão do usuário.

## Stack técnica (decidida, não reabrir discussão)

- **HTML/CSS/JavaScript vanilla** — sem React, Vue, ou qualquer framework de UI.
  O escopo do jogo não justifica a complexidade adicional
- **GSAP** (gsap.com) para todas as animações (flip de carta, movimento entre
  pilhas, animação de vitória) e **GSAP Draggable** para o drag-and-drop de
  cartas. GSAP é gratuito, incluindo os plugins antes pagos (Draggable, MorphSVG)
- **PWA**: `manifest.json` + Service Worker para instalação na tela de início e
  funcionamento offline. Sem build step (sem bundler tipo Webpack/Vite) — arquivos
  servidos diretamente
- **Sem dependências de backend** — jogo 100% client-side, estado salvo em
  `localStorage`
- **Sem TypeScript** a menos que o usuário peça — manter simples

## Estrutura de pastas esperada

```
/index.html
/manifest.json
/service-worker.js
/css/
  style.css
  cards.css           # posicionamento e estilo visual das cartas
/js/
  card.js              # representação de carta (naipe, valor, cor, virada)
  deck.js              # geração + shuffle do baralho
  game-state.js        # estado do jogo e validação de regras (equivalente ao game_manager)
  render.js             # atualização do DOM a partir do game-state
  drag-handler.js       # wrapper fino sobre GSAP Draggable, delega validação pro game-state
  score.js               # pontuação e timer
  win-animation.js       # animação de vitória (cascata de cartas)
  storage.js              # leitura/escrita em localStorage (novo jogo, estado salvo)
  main.js                  # bootstrap: inicializa o jogo, liga os módulos
/assets/
  cards/                    # sprites das 52 cartas + verso (SVG ou PNG)
  icons/                    # ícones do manifest.json (vários tamanhos)
```

## Regras do jogo (Klondike clássico — comportamento Windows 3.1)

Implementar exatamente este conjunto de regras, sem variações modernas por padrão:

1. **Baralho**: 52 cartas, 7 pilhas no tableau (1, 2, 3, 4, 5, 6, 7 cartas,
   última de cada pilha virada para cima)
2. **Stock/Waste**: modo padrão "Draw 1" (comprar 1 carta por vez do monte para o
   descarte). Redraw ilimitado do monte (voltar o waste pro stock quando o stock
   acabar) — comportamento clássico do Win 3.1, sem limite de passadas
3. **Tableau**: sequência decrescente com alternância de cor (vermelho/preto).
   Só é possível mover um grupo de cartas já em sequência válida
4. **Fundação**: 4 pilhas, uma por naipe, sequência crescente a partir do Ás (A,
   2, 3... até K). Só aceita carta do mesmo naipe na ordem certa
5. **Duplo clique / duplo tap**: manda a carta automaticamente para a fundação
   correta, se o movimento for válido. Se não houver fundação válida, não faz nada
6. **Pontuação** (replicar fórmula clássica do Win 3.1):
   - Waste → Tableau: +5
   - Waste → Foundation: +10
   - Tableau → Foundation: +10
   - Foundation → Tableau: −15
   - Virar carta do tableau (revelar): +5
   - Recycle do stock (waste volta pro stock): sem penalidade no modo padrão
     não-Vegas (não implementar modo Vegas)
   - Decaimento por tempo: a cada 10 segundos sem jogada, pontuação cai
     (aproximado, não precisa ser bit-exato)
7. **Auto Complete**: quando todas as 52 cartas estão viradas para cima (nenhuma
   carta oculta restando), habilitar botão/gesto de "completar automaticamente"
   que resolve o jogo sozinho movendo cartas para as fundações
8. **Vitória**: ao completar as 4 fundações, disparar animação de cartas
   "quicando" pela tela via GSAP (stagger + easing) — marca registrada do jogo
9. **Novo jogo**: botão de novo jogo (embaralha e reinicia). Undo é opcional — só
   implementar se for trivial dentro da arquitetura escolhida

## Arquitetura técnica (diretrizes, não regras rígidas)

- **`game-state.js`** centraliza o estado do jogo (posição de cada carta, pilha
  a que pertence, se está virada) e a validação de movimentos, na forma de
  funções puras sempre que possível (facilita testar sem DOM). `render.js` e
  `drag-handler.js` não decidem regras sozinhos — perguntam ao game-state se o
  movimento é válido
- **Representação de carta**: objeto simples `{ naipe, valor, cor, virada, id }`,
  não precisa de classe complexa
- **Drag and drop**: `GSAP Draggable` com `bounds` e `hitTest` para detectar
  overlap com pilhas de destino; ao soltar, delega a validação pro
  `game-state.js` — se inválido, anima a carta de volta pra posição original
  (GSAP já resolve isso com `Draggable.create({ ..., onDragEnd })` + `gsap.to()`)
- **Flip de carta**: `rotateY` via GSAP timeline, trocando a imagem/classe no
  meio da animação (quando a carta está de perfil, invisível)
- **Z-index / empilhamento**: controlar via `style.zIndex` no `render.js`
  conforme a ordem das cartas na pilha
- Evitar abstrações genéricas demais (ex: sistema de "regras plugáveis" para
  suportar variantes do jogo que não foram pedidas). O jogo é Klondike/Win 3.1,
  ponto — não generalizar para Spider, FreeCell, etc.

## PWA — requisitos específicos

- **`manifest.json`**: `name`, `short_name`, `display: "standalone"`,
  `background_color`, `theme_color`, `start_url`, e ícones em pelo menos 192x192
  e 512x512
- **Service Worker**: cache-first para todos os assets estáticos (HTML, CSS, JS,
  sprites de carta), permitindo que o jogo abra e seja jogável 100% offline após
  a primeira visita
- **Persistência de estado**: salvar em `localStorage` o estado da partida atual
  (pra retomar se fechar o navegador) e o melhor score. **Importante**: no iOS, o
  Safari pode limpar dados de `localStorage` de PWAs sem uso recente — tratar
  isso como best-effort, não como garantia de persistência permanente. Não é
  necessário implementar workaround para isso além de salvar de forma simples
- **iOS**: não há prompt automático de instalação como no Android/Chrome. Não é
  necessário implementar nenhuma lógica especial para isso — é comportamento do
  próprio Safari (instalação via "Compartilhar" → "Adicionar à Tela de Início")
- **Viewport**: meta tag `viewport-fit=cover` + tratamento de safe-area (notch)
  via CSS `env(safe-area-inset-*)`, já que o jogo deve preencher a tela em modo
  standalone

## Assets

- Sprites de cartas: se não houver asset pronto, usar um spritesheet CC0/livre
  de baralho padrão (ex: estilo "Kenney Playing Cards", gratuito e sem
  restrição de licença) — não gerar arte própria a menos que seja pedido.
  Preferir SVG quando possível (escala bem em qualquer resolução de tela sem
  pesar no bundle)
- Verso de carta: design simples, único verso para todas as cartas
- Ícones do PWA: gerar a partir de um design simples (pode ser um ícone de carta
  ou naipe), nos tamanhos exigidos pelo manifest
- Sons: opcional na primeira versão; deixar hook (`playSound()` como stub) para
  adicionar depois sem refatorar

## Fases de desenvolvimento (ordem sugerida)

1. **Setup do projeto**: estrutura de arquivos, `index.html` básico, import do
   GSAP via CDN ou local, `manifest.json` inicial
2. **Modelo de dados**: representação de carta e baralho (geração + shuffle) em
   `card.js`/`deck.js`, sem UI ainda
3. **Layout estático**: renderizar via CSS/DOM as 7 pilhas do tableau, 4
   fundações, stock e waste na posição correta, sem interação
4. **Interação básica**: GSAP Draggable de carta única entre pilhas, com
   validação de regras do tableau e fundação via `game-state.js`
5. **Movimento de grupos**: arrastar sequência de cartas já ordenada no tableau
6. **Stock/Waste**: clique no monte compra carta, redraw quando monte acaba
7. **Duplo clique/tap**: auto-move para fundação
8. **Pontuação e timer**: `score.js` com a fórmula da seção de regras
9. **Auto Complete**: detecção de "todas as cartas viradas" + resolução automática
10. **Animação de vitória**: cascata de cartas via GSAP ao completar o jogo
11. **Menu e novo jogo**: tela inicial simples, botão de novo jogo, exibição de
    score/tempo
12. **PWA**: `manifest.json` finalizado, Service Worker com cache offline,
    ícones, teste de instalação em Android e iOS
13. **Polish mobile**: ajustar tamanho de toque para dedo (hit area maior que o
    visual da carta), testar em diferentes tamanhos de tela, safe-area no iOS

## Critérios de aceite

- Jogo completo jogável do início ao fim (embaralhar → jogar → vencer) sem
  travamentos, em navegador mobile (Chrome/Android e Safari/iOS)
- Todas as regras da seção "Regras do jogo" implementadas e verificáveis
  manualmente
- Instalável como PWA em Android (prompt automático) e iOS (via Adicionar à
  Tela de Início), funcionando offline após primeira visita
- Código organizado conforme estrutura de pastas proposta, sem arquivos
  gigantes monolíticos (ex: `game-state.js` não deve acumular lógica de DOM)
- Sem dependências externas além do GSAP

## O que evitar (explícito)

- Não usar React, Vue, Svelte ou qualquer framework de UI
- Não adicionar bundler/build step (Webpack, Vite, etc.) — servir arquivos
  diretamente
- Não implementar variantes do jogo (Spider, FreeCell, Vegas scoring) — só
  Klondike clássico
- Não criar sistema de conquistas, ranking online, ou multiplayer
- Não adicionar monetização/ads — fora de escopo
- Não abstrair demais pensando em "extensibilidade futura" que não foi pedida
- Não tentar contornar a limitação de persistência do Safari/iOS com soluções
  complexas (IndexedDB com sync, etc.) — `localStorage` simples é suficiente
  para o escopo

## Entregável final

Projeto completo (HTML/CSS/JS + PWA), versionado, testável abrindo `index.html`
localmente (ou via servidor estático simples) e instalável na tela de início em
Android e iPhone, pronto para eu (usuário) ajustar detalhes visuais manualmente
se necessário.