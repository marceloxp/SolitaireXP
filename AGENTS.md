# SolitaireXP — notas para o agente

Clone de Paciência (Klondike, Draw-1) estilo Windows, como PWA em **HTML/CSS/JS
vanilla + GSAP** (via CDN, sem build step, sem framework, sem backend). Estado
salvo em `localStorage`. Repo: `github.com/marceloxp/SolitaireXP`, branch
principal `main`.

O `PLAN.md` original (spec inicial do projeto) foi removido depois que o jogo
ficou completo — este arquivo é o que substitui ele como contexto pra sessões
futuras.

## Estrutura do projeto

- `index.html` — shell da app (tela de menu + tela de jogo, alternadas via
  `body[data-screen]`)
- `manifest.json` — manifest do PWA
- `service-worker.js` — cache-first offline; pré-cacheia os 52 sprites de
  carta (gerados via loop com `SUITS`/`RANK_LABELS`, não hardcoded um a um) +
  assets estáticos. **Sempre que mudar a lista `ASSETS`, bump o `CACHE_NAME`**
  (ex: `v3` → `v4`), senão clientes com o SW antigo instalado ficam presos no
  cache velho e nem veem os arquivos novos.
- `css/style.css` — layout geral (HUD, toolbar fixo no rodapé, tema, cálculo
  responsivo de `--card-width`)
- `css/cards.css` — estilo visual/posicionamento das cartas
- `js/card.js` — modelo de carta (naipe, valor, cor, id, faceUp) + path da imagem
- `js/deck.js` — geração + shuffle (Fisher-Yates) do baralho
- `js/game-state.js` — **fonte única da verdade** das regras e validação de
  movimentos (funções puras, sem DOM)
- `js/render.js` — renderiza o DOM a partir do game-state (full re-render a
  cada mudança de estado: `root.innerHTML = ''` e reconstrói tudo)
- `js/drag-handler.js` — wrapper sobre GSAP Draggable; delega toda validação
  pro `game-state.js`
- `js/score.js` — pontuação e timer (fórmula clássica do Win 3.1; **não tem**
  feature de recorde/best score, foi removida a pedido do usuário)
- `js/storage.js` — leitura/escrita do estado da partida em `localStorage`
- `js/win-animation.js` — animação de vitória (cascata GSAP) + overlay com
  botão "Jogar novamente"
- `js/main.js` — bootstrap, liga os módulos, state machine simples (menu/jogo)
- `assets/cards/*.png` — 52 sprites + verso, redimensionados (240×336) e
  comprimidos (`pngquant`+`optipng`) a partir do pacote "Casino" em
  `.resources/Casino/Cards/` (gitignored; licença não verificada — checar
  antes de reusar fora deste projeto pessoal). Verso usado: `back01`.
- `assets/icons/` — ícones do PWA, gerados a partir de
  `.resources/icon-512x512.png` (mantido fora do git, não apagar sem re-gerar
  os ícones antes)

## Decisões de arquitetura importantes

- Sem regras "plugáveis"/genéricas — é só Klondike clássico. Não generalizar
  pra suportar outras variantes (Spider, FreeCell, Vegas scoring etc.).
- `game-state.js` é a única fonte da verdade das regras; `render.js` e
  `drag-handler.js` nunca decidem regra sozinhos, só perguntam pra ele.
- Cada mudança de estado causa um full teardown/rebuild do DOM. Isso é simples
  mas não tem animação de movimento entre pilhas — só a vitória usa
  `gsap.to()` de verdade. Ver "Pendências conhecidas" abaixo.
- `--card-width` (`css/style.css`) é calculado via `clamp()` a partir da
  largura real da viewport, não um valor fixo — garante que as 7 colunas do
  tableau + 4 fundações sempre cabem sem overflow horizontal em telas
  pequenas (chegou a vazar no iPhone SE antes desse fix).
- A altura de cada coluna do tableau é setada via JS
  (`render.js: column.style.minHeight`) porque as cartas são
  `position: absolute` e não "empurram" a altura do pai sozinhas — sem isso,
  pilhas longas ficavam cortadas/sobrepostas pelo conteúdo abaixo.
- A barra de ações ("Novo jogo" / "Completar automaticamente") é
  `position: fixed` no rodapé da viewport, não fica no fluxo normal do
  documento — assim ela não sobe/desce conforme as colunas crescem ou
  encolhem. `.screen-game` reserva espaço (`padding-bottom`) pra ela nunca
  tampar o tabuleiro.
- Botões têm `touch-action: manipulation` pra evitar o gesto de
  double-tap-zoom do Chrome mobile (ex: duplo toque no monte/stock pile).
- `.card` (`css/cards.css`) **não** tem `border-radius`: os sprites em
  `assets/cards/` já vêm com cantos arredondados desenhados (alfa
  transparente nos cantos). Um `border-radius` fixo em CSS por cima cortava
  o desenho (naipe/valor perto da borda) de forma inconsistente em telas
  pequenas, onde o raio fixo é proporcionalmente grande. A sombra do card
  usa `filter: drop-shadow(...)` (acompanha o alfa da imagem) em vez de
  `box-shadow` (que sempre segue o retângulo da caixa, ignorando a
  transparência).

## Persistência (`localStorage`)

- `solitairexp-game-state` — estado da partida atual (via `game-state.js`)
- `solitairexp-score-state` — pontos/tempo da partida atual
- ~~`solitairexp-best-score`~~ — removida (feature de recorde não existe
  mais); `main.js` limpa essa chave no `boot()` se ainda existir de versões
  antigas.

## Como rodar localmente

Precisa de servidor estático (ES modules + Service Worker não funcionam via
`file://`):

```bash
python3 -m http.server 8080
# ou
npx http-server -p 8080 -c-1
```

Abrir `http://localhost:8080/`.

## Como testar mudanças

O ambiente tem `playwright-cli` disponível — é a forma recomendada de validar
mudanças de verdade num navegador (não só ler o código):

```bash
playwright-cli open http://localhost:8080/ --device="iPhone SE"   # menor tela comum
playwright-cli open http://localhost:8080/ --device="iPhone 13"
playwright-cli resize 1280 900                                     # desktop
```

Sempre apagar os artefatos gerados em `.playwright-cli/` (screenshots/yml)
depois — não são pra ir pro commit.

**Cuidado com o Service Worker durante testes**: ele serve tudo cache-first,
então depois de editar JS/CSS é preciso limpar cache + desregistrar o SW no
navegador de teste antes de recarregar, senão o código antigo continua
rodando silenciosamente:

```js
const regs = await navigator.serviceWorker.getRegistrations();
for (const r of regs) await r.unregister();
const keys = await caches.keys();
for (const k of keys) await caches.delete(k);
```

### Atalho pra ver a animação de vitória sem jogar a partida inteira

Colar no console do navegador (monta um `game-state` com cada naipe já
ordenado K→A numa coluna só; "Completar automaticamente" resolve tudo
sozinho a partir daí):

```js
(() => {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
  const color = (s) => (s === 'hearts' || s === 'diamonds') ? 'red' : 'black';
  const mk = (suit, rank) => ({
    id: `${suit}-${rank}-${Math.random().toString(36).slice(2, 9)}`,
    suit, rank, color: color(suit), faceUp: true,
  });
  const tableau = suits.map((suit) => {
    const pile = [];
    for (let rank = 13; rank >= 1; rank -= 1) pile.push(mk(suit, rank));
    return pile;
  });
  tableau.push([], [], []);
  const state = { stock: [], waste: [], foundations: [[], [], [], []], tableau, won: false, moves: 0 };
  localStorage.setItem('solitairexp-game-state', JSON.stringify(state));
  localStorage.setItem('solitairexp-score-state', JSON.stringify({ score: 0, elapsedSeconds: 0, idleSeconds: 0 }));
  location.reload();
})();
```

Depois: **Continuar** → **Completar automaticamente**.

## Regras do jogo implementadas (Klondike clássico, Draw-1)

- **Stock/Waste**: compra 1 carta por vez; redraw ilimitado (o waste volta pro
  stock preservando a ordem original de compra).
- **Tableau**: sequência decrescente com alternância de cor; só Rei entra em
  coluna vazia; só é possível mover um grupo se já formar sequência válida.
- **Fundação**: sobe por naipe a partir do Ás; só aceita a próxima carta em
  sequência.
- **Clique único**: se a carta clicada (topo do waste, topo do tableau, ou
  parte de uma sequência válida no meio de uma coluna) "serve" em algum
  destino, o clique já executa o movimento automaticamente — não precisa
  arrastar. Prioridade: fundação primeiro, senão a primeira coluna do
  tableau (esquerda pra direita) que aceitar a carta/grupo, incluindo Rei
  em coluna vazia. Clicar numa carta que já está na fundação não faz nada
  (não volta pro tableau sozinha, só via arraste manual). Implementado em
  `handleCardClick` (`js/main.js`) usando o callback `onClick` do GSAP
  Draggable (`js/drag-handler.js`), que só dispara quando não houve arrasto
  de verdade, então não conflita com o drag manual.
- **Pontuação** (fórmula clássica Win 3.1): Waste→Tableau +5,
  Waste→Fundação +10, Tableau→Fundação +10, Fundação→Tableau −15, revelar
  carta do tableau +5, decaimento −2 a cada 10s sem jogada, sem penalidade ao
  reciclar o monte.
- **Auto Complete**: habilita quando não há mais cartas ocultas nem
  stock/waste; resolve sozinho de forma gulosa (sempre funciona nesse
  estado).
- **Vitória**: cascata de cartas via GSAP + overlay "Você venceu!" com botão
  "Jogar novamente" (reinicia o jogo e limpa animação/overlay residuais).
- **Desfazer**: até 3 jogadas pra trás (`MAX_UNDO` em `js/main.js`). Cada
  handler de jogada (compra do monte, drag manual, clique único, e o
  auto-complete inteiro como UM passo atômico) tira um snapshot
  (`snapshotState()`, clone via `serializeState`) do `gameState`+`scoreState`
  *antes* de mutar e só empilha (`pushHistory`) se a jogada realmente
  aconteceu. Histórico é zerado em `startNewGame()` e ao carregar via
  "Continuar" (não persiste entre reloads). Botão `#btn-undo` fica oculto
  quando a pilha está vazia ou o jogo já foi ganho.
- **Confirmação no "Novo jogo"**: o botão da barra inferior (dentro da
  partida) abre um overlay de confirmação (`confirmAction()` em
  `js/main.js`, `.confirm-overlay`/`.confirm-box` no CSS) antes de descartar
  o jogo atual. O "Novo jogo" do menu inicial não tem essa confirmação (não
  há progresso visível pra perder naquele ponto).
- **Barra inferior**: "Novo jogo" fica ancorado à esquerda, "Desfazer" à
  direita (`justify-content: space-between` em `.toolbar`); "Completar
  automaticamente" aparece entre os dois quando habilitado.
- **Ícones**: todos os ícones da UI (estatísticas do HUD e botões da barra
  inferior) são SVGs inline no `index.html` (estilo Feather Icons, MIT,
  `stroke="currentColor"`), não Font Awesome nem outra CDN — mantém o PWA
  100% offline sem requests externos. Classe `.icon` controla o tamanho
  (`1em` no HUD pra acompanhar o `font-size`, `18px` fixo nos botões da
  toolbar). Cuidado ao adicionar `display` num seletor que também bate em
  elementos com `[hidden]` (ex.: `.toolbar button`): o `[hidden]` do HTML só
  vira `display: none` via UA stylesheet (baixa prioridade), então uma regra
  de autor com `display: flex/inline-flex` no mesmo elemento *sobrescreve* o
  hidden nativo. Por isso existe `.toolbar button[hidden] { display: none; }`
  explícito no CSS — sem essa regra os botões `#btn-undo`/`#btn-auto-complete`
  aparecem mesmo com o atributo `hidden` presente no DOM.
- **Textura de feltro**: o fundo (`body` em `css/style.css`) tem duas camadas
  de `repeating-linear-gradient` diagonais (45°/-45°, opacidade ~3.5%) por
  cima do `radial-gradient` original, simulando a trama de um feltro de mesa.
  Puro CSS, sem imagem extra.
- **Modal com glassmorphism**: `.confirm-box` usa fundo semi-transparente
  (`rgba` da cor `--felt-dark`) + `backdrop-filter: blur(10px)` (com prefixo
  `-webkit-` pra Safari/iOS) em vez de fundo opaco.
- **`zIndexBoost: false` no Draggable (`js/drag-handler.js`)**: o default do
  GSAP (`true`) sobe o z-index do elemento pressionado acima de todos os
  irmãos assim que o `onPress` dispara — mesmo num clique sem arrasto real.
  Como o z-index de cada carta já é controlado manualmente (`10 +
  cardIndex` em `render.js`, e reaplicado em `restoreGroup`), esse boost só
  causava problema: uma carta do meio da coluna "pulava" pra frente das
  cartas seguintes num simples clique, e num arraste de grupo colocava a
  carta "pega" acima das outras do próprio grupo. Ficou desligado de
  propósito — não reativar sem entender esse efeito colateral.
- **Offset em cascata no arraste de grupo**: `moveGroupToDragLayer` já
  aplica `idx * TABLEAU_OFFSET` como `top` estático de cada carta do grupo
  ao movê-las pro `#drag-layer`; o `onDrag` só deve somar o delta bruto do
  arraste (`this.x`/`this.y`) por cima disso. Somar o offset de novo no
  `onDrag` (como acontecia antes) fazia as cartas do grupo se afastarem
  verticalmente conforme o arraste avançava.
- **Cache do navegador ao testar com `playwright-cli`**: editar `css/style.css`
  ou `js/*.js` enquanto uma sessão do `playwright-cli` já está aberta pode não
  refletir no browser — `reload`/`goto` fazem soft-reload e o Chromium às
  vezes reaproveita o CSS antigo do cache HTTP. Se uma mudança de CSS parecer
  "não aplicada" durante testes, rode `playwright-cli close` e `open` de novo
  (sessão nova = cache novo) antes de desconfiar da regra em si.
- **Orientação travada em retrato**: não existe um "lock" universal de
  orientação numa aba de navegador comum (a Screen Orientation API só
  funciona em fullscreen de verdade ou PWA instalado em modo
  standalone/fullscreen — `screen.orientation.lock('portrait')`, chamado em
  `lockOrientation()` no `boot()` do `js/main.js`, falha silenciosamente
  fora desses contextos, por isso o `.catch(() => {})`). A cobertura real
  pro caso geral é `manifest.json` (`"orientation": "portrait"`, vale pro
  PWA instalado) + o overlay `#rotate-overlay` (`css/style.css`), que cobre
  a tela com um aviso pra girar de volta quando o `@media (orientation:
  landscape) and (hover: none) and (pointer: coarse)` bate — restrito a
  telas de toque sem mouse pra não incomodar quem só deixa a janela do
  desktop larga e baixa.

## Pendências conhecidas (não implementadas)

- Animações GSAP de flip de carta (`rotateY`) e de movimento entre pilhas
  (compra do monte, mover carta, auto-complete) — hoje é troca instantânea de
  DOM. Só a vitória tem animação de verdade.
- `js/drag-handler.js` exporta uma função `flashInvalid()` que nunca é usada
  em lugar nenhum (feedback visual de jogada inválida ficou incompleto).
- Sem testes automatizados no repo; toda validação até agora foi manual via
  `playwright-cli` durante as sessões de desenvolvimento.

## Convenções

- Mensagens de commit descritivas, com corpo em bullet points explicando o
  "porquê" da mudança, não só o "o quê".
- Só commitar quando o usuário pedir explicitamente.
- Não usar `rm` recursivo pra apagar pastas (bloqueado no ambiente) — apagar
  arquivo por arquivo, ou pedir pro usuário remover o diretório vazio depois.
