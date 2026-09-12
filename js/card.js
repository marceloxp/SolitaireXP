import { getActiveTheme } from './themes.js';

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
    return getActiveTheme().cardBack;
  }
  return faceCardImagePath(card.suit, card.rank);
}

export function faceCardImagePath(suit, rank) {
  return `assets/cards/card_${suit}_${rankLabel(rank)}.png`;
}

export function getAllFaceCardImagePaths() {
  const paths = [];
  SUITS.forEach((suit) => {
    for (let rank = 1; rank <= 13; rank += 1) {
      paths.push(faceCardImagePath(suit, rank));
    }
  });
  return paths;
}

function preloadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

export function preloadGameCardImages() {
  const urls = new Set(getAllFaceCardImagePaths());
  urls.add(getActiveTheme().cardBack);
  return Promise.all([...urls].map(preloadImage));
}

export function foundationIndexForSuit(suit) {
  return SUITS.indexOf(suit);
}

export function suitForFoundationIndex(index) {
  return SUITS[index];
}
