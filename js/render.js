import { cardImagePath } from './card.js';
import { PILE } from './game-state.js';

const TABLEAU_OFFSET = 22;

export function renderGame(root, state, handlers = {}) {
  root.innerHTML = '';

  const board = document.createElement('div');
  board.className = 'board';

  const topRow = document.createElement('div');
  topRow.className = 'top-row';

  topRow.appendChild(createStockWaste(state, handlers));
  topRow.appendChild(createSpacer());
  topRow.appendChild(createFoundations(state));

  const tableauRow = document.createElement('div');
  tableauRow.className = 'tableau-row';
  for (let i = 0; i < 7; i += 1) {
    tableauRow.appendChild(createTableauColumn(state.tableau[i], i));
  }

  board.append(topRow, tableauRow);
  root.appendChild(board);

  return root;
}

function createSpacer() {
  const el = document.createElement('div');
  el.className = 'top-spacer';
  return el;
}

function createStockWaste(state, handlers) {
  const wrap = document.createElement('div');
  wrap.className = 'stock-waste';

  const stock = document.createElement('button');
  stock.type = 'button';
  stock.className = 'pile pile-stock';
  stock.dataset.pile = PILE.STOCK;
  stock.setAttribute('aria-label', 'Monte');
  stock.addEventListener('click', () => handlers.onStockClick?.());

  if (state.stock.length) {
    stock.appendChild(createCardElement(state.stock[state.stock.length - 1], {
      pile: PILE.STOCK,
      draggable: false,
      faceUp: false,
    }));
  } else {
    stock.classList.add('empty');
    stock.textContent = '↻';
  }

  const waste = document.createElement('div');
  waste.className = 'pile pile-waste';
  waste.dataset.pile = PILE.WASTE;
  if (state.waste.length) {
    const top = state.waste[state.waste.length - 1];
    waste.appendChild(createCardElement(top, {
      pile: PILE.WASTE,
      index: 0,
      draggable: true,
    }));
  }

  wrap.append(stock, waste);
  return wrap;
}

function createFoundations(state) {
  const wrap = document.createElement('div');
  wrap.className = 'foundations';
  for (let i = 0; i < 4; i += 1) {
    const pile = document.createElement('div');
    pile.className = 'pile pile-foundation';
    pile.dataset.pile = PILE.FOUNDATION;
    pile.dataset.index = String(i);
    const cards = state.foundations[i];
    if (cards.length) {
      pile.appendChild(createCardElement(cards[cards.length - 1], {
        pile: PILE.FOUNDATION,
        index: i,
        draggable: true,
      }));
    }
    wrap.appendChild(pile);
  }
  return wrap;
}

function createTableauColumn(cards, columnIndex) {
  const column = document.createElement('div');
  column.className = 'pile pile-tableau';
  column.dataset.pile = PILE.TABLEAU;
  column.dataset.index = String(columnIndex);

  cards.forEach((card, cardIndex) => {
    column.appendChild(createCardElement(card, {
      pile: PILE.TABLEAU,
      index: columnIndex,
      cardIndex,
      draggable: card.faceUp,
      offset: cardIndex * TABLEAU_OFFSET,
    }));
  });

  // Os cards são posicionados com position:absolute, então o container não
  // cresce sozinho com a pilha; sem isso, pilhas longas ficam maiores que a
  // altura mínima fixa e passam por cima do que vem depois do tabuleiro.
  const stackedHeight = Math.max(0, cards.length - 1) * TABLEAU_OFFSET;
  column.style.minHeight = `calc(var(--card-height) + ${stackedHeight + 110}px)`;

  return column;
}

function createCardElement(card, options) {
  const el = document.createElement('div');
  el.className = 'card';
  if (!card.faceUp && options.pile !== PILE.STOCK) {
    el.classList.add('face-down');
  }
  el.dataset.cardId = card.id;
  el.dataset.pile = options.pile;
  if (options.index !== undefined) {
    el.dataset.index = String(options.index);
  }
  if (options.cardIndex !== undefined) {
    el.dataset.cardIndex = String(options.cardIndex);
  }
  el.style.backgroundImage = `url("${cardImagePath(card)}")`;
  el.style.zIndex = String(10 + (options.cardIndex ?? 0));
  if (options.offset) {
    el.style.setProperty('--stack-offset', `${options.offset}px`);
  }
  if (options.draggable) {
    el.classList.add('draggable');
  }
  return el;
}

export function updateHud(hud, scoreState, gameState) {
  hud.querySelector('[data-score]').textContent = String(scoreState.score);
  hud.querySelector('[data-time]').textContent = formatHudTime(scoreState.elapsedSeconds);
  hud.querySelector('[data-moves]').textContent = String(gameState?.moves ?? 0);
}

function formatHudTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function getDropTargets() {
  return [...document.querySelectorAll('.pile-foundation, .pile-tableau')];
}

export function getCardElements() {
  return [...document.querySelectorAll('.card.draggable')];
}

export { TABLEAU_OFFSET };
