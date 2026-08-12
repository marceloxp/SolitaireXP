export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RED_SUITS = new Set(['hearts', 'diamonds']);

const RANK_LABELS = {
  1: 'A',
  11: 'J',
  12: 'Q',
  13: 'K',
};

export function rankLabel(rank) {
  return RANK_LABELS[rank] || String(rank).padStart(2, '0');
}

export function cardColor(suit) {
  return RED_SUITS.has(suit) ? 'red' : 'black';
}

export function createCard(suit, rank, faceUp = false) {
  return {
    id: `${suit}-${rank}-${Math.random().toString(36).slice(2, 9)}`,
    suit,
    rank,
    color: cardColor(suit),
    faceUp,
  };
}

export function cardImagePath(card) {
  if (!card.faceUp) {
    return 'assets/cards/card_back.png';
  }
  return `assets/cards/card_${card.suit}_${rankLabel(card.rank)}.png`;
}

export function foundationIndexForSuit(suit) {
  return SUITS.indexOf(suit);
}

export function suitForFoundationIndex(index) {
  return SUITS[index];
}
