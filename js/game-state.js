import { createShuffledDeck } from './deck.js';
import { foundationIndexForSuit } from './card.js';

export const PILE = {
  STOCK: 'stock',
  WASTE: 'waste',
  FOUNDATION: 'foundation',
  TABLEAU: 'tableau',
};

export function createInitialState() {
  return {
    stock: [],
    waste: [],
    foundations: [[], [], [], []],
    tableau: [[], [], [], [], [], [], []],
    won: false,
    moves: 0,
  };
}

export function dealNewGame(state = createInitialState()) {
  const deck = createShuffledDeck();
  const next = createInitialState();

  for (let col = 0; col < 7; col += 1) {
    for (let row = 0; row <= col; row += 1) {
      const card = deck.pop();
      card.faceUp = row === col;
      next.tableau[col].push(card);
    }
  }

  next.stock = deck;
  return next;
}

function topCard(pile) {
  return pile.length ? pile[pile.length - 1] : null;
}

function oppositeColor(a, b) {
  return a.color !== b.color;
}

export function canPlaceOnTableau(card, targetPile) {
  const target = topCard(targetPile);
  if (!target) {
    return card.rank === 13;
  }
  if (!target.faceUp) {
    return false;
  }
  return oppositeColor(card, target) && card.rank === target.rank - 1;
}

export function canPlaceOnFoundation(card, foundationPile) {
  const target = topCard(foundationPile);
  if (!target) {
    return card.rank === 1;
  }
  return card.suit === target.suit && card.rank === target.rank + 1;
}

export function getMovableRun(tableauPile, fromIndex) {
  const pile = tableauPile;
  if (fromIndex < 0 || fromIndex >= pile.length) {
    return null;
  }
  if (!pile[fromIndex].faceUp) {
    return null;
  }

  const run = pile.slice(fromIndex);
  for (let i = 1; i < run.length; i += 1) {
    const prev = run[i - 1];
    const curr = run[i];
    if (!curr.faceUp || !oppositeColor(prev, curr) || curr.rank !== prev.rank - 1) {
      return null;
    }
  }
  return run;
}

export function locateCard(state, cardId) {
  for (const card of state.waste) {
    if (card.id === cardId) {
      return { pile: PILE.WASTE, index: 0, card, cards: [card] };
    }
  }

  for (let i = 0; i < state.foundations.length; i += 1) {
    const pile = state.foundations[i];
    const idx = pile.findIndex((c) => c.id === cardId);
    if (idx !== -1) {
      const cards = pile.slice(idx);
      return { pile: PILE.FOUNDATION, index: i, cardIndex: idx, card: pile[idx], cards };
    }
  }

  for (let i = 0; i < state.tableau.length; i += 1) {
    const pile = state.tableau[i];
    const idx = pile.findIndex((c) => c.id === cardId);
    if (idx !== -1) {
      const run = getMovableRun(pile, idx);
      if (!run) {
        return null;
      }
      return { pile: PILE.TABLEAU, index: i, cardIndex: idx, card: pile[idx], cards: run };
    }
  }

  return null;
}

export function isWasteTop(state, cardId) {
  const wasteTop = topCard(state.waste);
  return wasteTop?.id === cardId;
}

export function isFoundationTop(state, foundationIndex, cardId) {
  const pile = state.foundations[foundationIndex];
  return topCard(pile)?.id === cardId;
}

export function canMoveToTableau(state, source, targetColumn) {
  const targetPile = state.tableau[targetColumn];
  const movingCard = source.cards[0];
  if (source.pile === PILE.WASTE && !isWasteTop(state, movingCard.id)) {
    return false;
  }
  if (source.pile === PILE.FOUNDATION) {
    if (source.cards.length !== 1 || !isFoundationTop(state, source.index, movingCard.id)) {
      return false;
    }
  }
  if (source.pile === PILE.TABLEAU) {
    const run = getMovableRun(state.tableau[source.index], source.cardIndex);
    if (!run || run[0].id !== movingCard.id) {
      return false;
    }
  }
  return canPlaceOnTableau(movingCard, targetPile);
}

export function canMoveToFoundation(state, source, foundationIndex) {
  if (source.cards.length !== 1) {
    return false;
  }
  const card = source.cards[0];
  if (source.pile === PILE.WASTE && !isWasteTop(state, card.id)) {
    return false;
  }
  if (source.pile === PILE.TABLEAU) {
    const pile = state.tableau[source.index];
    if (source.cardIndex !== pile.length - 1) {
      return false;
    }
  }
  if (source.pile === PILE.FOUNDATION) {
    return false;
  }
  return canPlaceOnFoundation(card, state.foundations[foundationIndex]);
}

export function removeCardsFromSource(state, source) {
  if (source.pile === PILE.WASTE) {
    state.waste.pop();
    return;
  }
  if (source.pile === PILE.FOUNDATION) {
    state.foundations[source.index].pop();
    return;
  }
  state.tableau[source.index].splice(source.cardIndex, source.cards.length);
}

export function maybeFlipTableauTop(state, columnIndex) {
  const pile = state.tableau[columnIndex];
  if (!pile.length) {
    return false;
  }
  const top = pile[pile.length - 1];
  if (top.faceUp) {
    return false;
  }
  top.faceUp = true;
  return true;
}

export function applyMoveToTableau(state, source, targetColumn) {
  if (!canMoveToTableau(state, source, targetColumn)) {
    return { ok: false };
  }

  removeCardsFromSource(state, source);
  let flipped = false;
  if (source.pile === PILE.TABLEAU) {
    flipped = maybeFlipTableauTop(state, source.index);
  }
  state.tableau[targetColumn].push(...source.cards);
  state.moves += 1;
  return { ok: true, flipped, moved: source.cards.length };
}

export function applyMoveToFoundation(state, source, foundationIndex) {
  if (!canMoveToFoundation(state, source, foundationIndex)) {
    return { ok: false };
  }

  const card = source.cards[0];
  removeCardsFromSource(state, source);
  let flipped = false;
  if (source.pile === PILE.TABLEAU) {
    flipped = maybeFlipTableauTop(state, source.index);
  }
  state.foundations[foundationIndex].push(card);
  state.moves += 1;
  return { ok: true, flipped, card };
}

export function drawFromStock(state) {
  if (state.stock.length) {
    const card = state.stock.pop();
    card.faceUp = true;
    state.waste.push(card);
    state.moves += 1;
    return { action: 'draw' };
  }

  if (!state.waste.length) {
    return { action: 'none' };
  }

  while (state.waste.length) {
    const card = state.waste.pop();
    card.faceUp = false;
    state.stock.push(card);
  }
  state.moves += 1;
  return { action: 'recycle' };
}

export function findFoundationTarget(state, source) {
  for (let i = 0; i < state.foundations.length; i += 1) {
    if (canMoveToFoundation(state, source, i)) {
      return i;
    }
  }
  return -1;
}

export function autoMoveToFoundation(state, cardId) {
  const source = locateCard(state, cardId);
  if (!source) {
    return { ok: false };
  }
  for (let i = 0; i < state.foundations.length; i += 1) {
    if (canMoveToFoundation(state, source, i)) {
      const result = applyMoveToFoundation(state, source, i);
      return { ok: true, ...result, foundationIndex: i, from: source.pile };
    }
  }
  return { ok: false };
}

export function allCardsFaceUp(state) {
  if (state.stock.length || state.waste.length) {
    return false;
  }
  for (const pile of state.tableau) {
    for (const card of pile) {
      if (!card.faceUp) {
        return false;
      }
    }
  }
  return true;
}

export function isGameWon(state) {
  return state.foundations.every((pile) => pile.length === 13);
}

export function canAutoComplete(state) {
  if (state.won || !allCardsFaceUp(state)) {
    return false;
  }
  return !isGameWon(state);
}

export function getAutoCompleteMoves(state) {
  const moves = [];
  const snapshot = cloneState(state);

  for (let safety = 0; safety < 200; safety += 1) {
    let moved = false;

    for (let col = 6; col >= 0; col -= 1) {
      const pile = snapshot.tableau[col];
      if (!pile.length) {
        continue;
      }
      const top = pile[pile.length - 1];
      const source = locateCard(snapshot, top.id);
      for (let f = 0; f < 4; f += 1) {
        if (canMoveToFoundation(snapshot, source, f)) {
          moves.push({ cardId: top.id, fromColumn: col, foundationIndex: f });
          applyMoveToFoundation(snapshot, source, f);
          moved = true;
          break;
        }
      }
      if (moved) {
        break;
      }
    }

    if (!moved) {
      break;
    }
  }

  return moves;
}

export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

export function serializeState(state) {
  return JSON.stringify(state);
}

export function deserializeState(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.tableau)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
