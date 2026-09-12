import { cardImagePath } from './card.js';
import { locateCard, PILE } from './game-state.js';
import {
  TABLEAU_OFFSET,
  syncFoundationPileDom,
  syncTableauColumnHeights,
  syncWastePileDom,
} from './render.js';

const DURATION = 0.22;
const EASE = 'power2.out';
const LAYER_Z = 3000;

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function getLayer() {
  return document.querySelector('#drag-layer');
}

function getRoot() {
  return document.querySelector('#game-root');
}

function setAnimating(active) {
  getRoot()?.classList.toggle('is-animating', active);
}

function mountOnLayer(cardEl, fromRect, options = {}) {
  const layer = options.layer ?? getLayer();
  const layerRect = options.layerRect ?? layer.getBoundingClientRect();
  layer.appendChild(cardEl);
  if (options.syncHeights !== false && cardEl.dataset.pile === 'tableau') {
    syncTableauColumnHeights();
  }
  gsap.set(cardEl, {
    position: 'absolute',
    left: fromRect.left - layerRect.left,
    top: fromRect.top - layerRect.top,
    x: 0,
    y: 0,
    zIndex: LAYER_Z,
  });
  return layerRect;
}

export function mountFlyingCard(cardEl, fromRect) {
  if (!cardEl || !fromRect || cardEl.parentElement === getLayer()) {
    return;
  }
  mountOnLayer(cardEl, fromRect);
}

export function captureCardPositions(root = getRoot()) {
  const map = new Map();
  if (!root) {
    return map;
  }
  root.querySelectorAll('.card').forEach((el) => {
    const id = el.dataset.cardId;
    if (!id) {
      return;
    }
    const rect = el.getBoundingClientRect();
    map.set(id, { x: rect.left, y: rect.top, width: rect.width, height: rect.height });
  });
  return map;
}

export function getPlayTargetRect(state, pile, index, cardId) {
  let pileEl;
  if (pile === PILE.TABLEAU) {
    pileEl = document.querySelector(`.pile-tableau[data-index="${index}"]`);
  } else if (pile === PILE.FOUNDATION) {
    pileEl = document.querySelector(`.pile-foundation[data-index="${index}"]`);
  } else if (pile === PILE.WASTE) {
    pileEl = document.querySelector('.pile-waste');
  } else if (pile === PILE.STOCK) {
    pileEl = document.querySelector('.pile-stock');
  }
  if (!pileEl) {
    return null;
  }
  const rect = pileEl.getBoundingClientRect();
  if (pile === PILE.TABLEAU) {
    const cardIndex = state.tableau[index].findIndex((c) => c.id === cardId);
    if (cardIndex < 0) {
      return null;
    }
    return {
      left: rect.left,
      top: rect.top + cardIndex * TABLEAU_OFFSET,
      width: rect.width,
      height: rect.height,
    };
  }
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

export function getGroupTargetRects(state, source, target, cardId) {
  const located = locateCard(state, cardId);
  if (!located) {
    return [];
  }
  const cards = located.cards;

  if (target.pile === PILE.TABLEAU) {
    const column = state.tableau[target.index];
    const startIndex = column.length - cards.length;
    const pileEl = document.querySelector(`.pile-tableau[data-index="${target.index}"]`);
    if (!pileEl) {
      return [];
    }
    const rect = pileEl.getBoundingClientRect();
    return cards.map((_, i) => ({
      left: rect.left,
      top: rect.top + (startIndex + i) * TABLEAU_OFFSET,
      width: rect.width,
      height: rect.height,
    }));
  }

  if (target.pile === PILE.FOUNDATION) {
    const pileEl = document.querySelector(`.pile-foundation[data-index="${target.index}"]`);
    if (!pileEl) {
      return [];
    }
    const rect = pileEl.getBoundingClientRect();
    return [{
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    }];
  }

  return [];
}

function flyDelta(cardEl, fromRect, toRect, delay = 0) {
  const dx = toRect.left - fromRect.left;
  const dy = toRect.top - fromRect.top;
  gsap.set(cardEl, { x: 0, y: 0, rotateY: 0 });
  return gsap.to(cardEl, {
    x: dx,
    y: dy,
    delay,
    duration: DURATION,
    ease: EASE,
  });
}

async function flyOnLayer(cardEl, fromRect, toRect) {
  if (!cardEl || !fromRect || !toRect || prefersReducedMotion()) {
    return;
  }

  mountFlyingCard(cardEl, fromRect);
  await flyDelta(cardEl, fromRect, toRect);
  cardEl.remove();
  gsap.set(cardEl, { clearProps: 'all' });
}

function mountFlightsOnLayer(flights) {
  const layer = getLayer();
  const pending = flights.filter(({ cardEl }) => cardEl.parentElement !== layer);
  if (!pending.length) {
    return;
  }

  const layerRect = layer.getBoundingClientRect();
  let movedFromTableau = false;
  pending.forEach(({ cardEl, fromRect }) => {
    movedFromTableau ||= cardEl.dataset.pile === PILE.TABLEAU;
    mountOnLayer(cardEl, fromRect, {
      layer,
      layerRect,
      syncHeights: false,
    });
  });

  if (movedFromTableau) {
    syncTableauColumnHeights();
  }
}

async function flyManyOnLayer(flights, options = {}) {
  if (!flights.length || prefersReducedMotion()) {
    return;
  }

  const manageAnimating = options.manageAnimating !== false;
  if (manageAnimating) {
    setAnimating(true);
  }
  try {
    mountFlightsOnLayer(flights);
    options.onMounted?.();
    const stagger = options.stagger ?? 0;
    const tweens = flights.map(({ cardEl, fromRect, toRect }, index) => {
      return flyDelta(cardEl, fromRect, toRect, index * stagger);
    });
    await Promise.all(tweens);
    if (!options.retain) {
      flights.forEach(({ cardEl }) => {
        cardEl.remove();
        gsap.set(cardEl, { clearProps: 'all' });
      });
    }
  } finally {
    if (manageAnimating) {
      setAnimating(false);
    }
  }
}

export function mountTableauGroupOnLayer(groupEls) {
  if (!groupEls?.length) {
    return;
  }

  const layer = getLayer();
  const first = groupEls[0];
  const rect = first.getBoundingClientRect();
  const layerRect = layer.getBoundingClientRect();

  groupEls.forEach((node, idx) => {
    layer.appendChild(node);
    gsap.set(node, {
      position: 'absolute',
      left: rect.left - layerRect.left,
      top: rect.top - layerRect.top + idx * TABLEAU_OFFSET,
      x: 0,
      y: 0,
      zIndex: LAYER_Z + idx,
    });
  });
  syncTableauColumnHeights();
}

export async function animateStockToWaste(cardEl, drawnCard, fromRect, toRect) {
  if (!cardEl || !fromRect || !toRect || prefersReducedMotion()) {
    return;
  }

  const layer = getLayer();
  const root = getRoot();
  if (!layer || !root) {
    return;
  }

  mountFlyingCard(cardEl, fromRect);
  setAnimating(true);

  try {
    gsap.set(cardEl, {
      rotateY: 0,
      transformPerspective: 600,
      transformOrigin: '50% 50%',
      x: 0,
      y: 0,
    });
    const faceUpUrl = cardImagePath(drawnCard);
    const flipHalf = 0.09;
    const nudgeX = Math.round(fromRect.width * 0.14);
    const dx = toRect.left - fromRect.left;
    const dy = toRect.top - fromRect.top;

    const tl = gsap.timeline();
    tl.to(cardEl, {
      rotateY: 90,
      x: nudgeX,
      duration: flipHalf,
      ease: 'power1.in',
    })
      .call(() => {
        cardEl.style.backgroundImage = `url("${faceUpUrl}")`;
        cardEl.classList.remove('face-down');
      })
      .to(cardEl, { rotateY: 0, duration: flipHalf, ease: 'power1.out' })
      .to(cardEl, { x: dx, y: dy, duration: DURATION, ease: EASE });

    await tl;
  } finally {
    cardEl.remove();
    gsap.set(cardEl, { clearProps: 'all' });
    setAnimating(false);
  }
}

export async function animateWasteToPlay(cardEl, fromRect, toRect) {
  if (!cardEl || !fromRect || !toRect) {
    return;
  }
  setAnimating(true);
  try {
    if (cardEl.parentElement === getLayer()) {
      await flyDelta(cardEl, fromRect, toRect);
      cardEl.remove();
      gsap.set(cardEl, { clearProps: 'all' });
    } else {
      await flyOnLayer(cardEl, fromRect, toRect);
    }
  } finally {
    setAnimating(false);
  }
}

export async function animateDragGroupOnLayer(groupEls, targetRects) {
  if (!groupEls?.length || !targetRects?.length) {
    return;
  }

  const flights = groupEls.map((cardEl, i) => {
    const fromRect = cardEl.getBoundingClientRect();
    const toRect = targetRects[i] ?? targetRects[targetRects.length - 1];
    return { cardEl, fromRect, toRect };
  });

  await flyManyOnLayer(flights);
}

export async function animateCardToTarget(cardEl, fromRect, toRect) {
  if (!cardEl || !fromRect || !toRect) {
    return;
  }
  setAnimating(true);
  try {
    if (cardEl.parentElement === getLayer()) {
      await flyDelta(cardEl, fromRect, toRect);
      cardEl.remove();
      gsap.set(cardEl, { clearProps: 'all' });
    } else {
      await flyOnLayer(cardEl, fromRect, toRect);
    }
  } finally {
    setAnimating(false);
  }
}

export async function animateWasteToStockUndo(cardEl, card, fromRect, toRect) {
  if (!cardEl || !fromRect || !toRect || prefersReducedMotion()) {
    return;
  }

  mountFlyingCard(cardEl, fromRect);
  setAnimating(true);

  try {
    gsap.set(cardEl, {
      rotateY: 0,
      transformPerspective: 600,
      transformOrigin: '50% 50%',
      x: 0,
      y: 0,
    });

    await gsap.to(cardEl, { rotateY: 90, duration: 0.09, ease: 'power1.in' });
    cardEl.style.backgroundImage = `url("${cardImagePath({ ...card, faceUp: false })}")`;
    cardEl.classList.add('face-down');
    await gsap.to(cardEl, { rotateY: 0, duration: 0.09, ease: 'power1.out' });
    await flyDelta(cardEl, fromRect, toRect);
  } finally {
    cardEl.remove();
    gsap.set(cardEl, { clearProps: 'all' });
    setAnimating(false);
  }
}

export function detectUndoMove(current, restored) {
  if (restored.stock.length > current.stock.length
    && restored.waste.length < current.waste.length) {
    return {
      type: 'stock-draw',
      cardId: current.waste[current.waste.length - 1]?.id,
    };
  }

  const restoredWasteTop = restored.waste[restored.waste.length - 1]?.id;
  const currentWasteTop = current.waste[current.waste.length - 1]?.id;
  if (restoredWasteTop && restoredWasteTop !== currentWasteTop) {
    return { type: 'to-waste', cardId: restoredWasteTop };
  }

  return { type: 'generic' };
}

function revealUndonePileTops(state, cardEls) {
  let syncWaste = false;
  const foundationIndexes = new Set();
  cardEls.forEach((cardEl) => {
    if (cardEl.dataset.pile === PILE.WASTE) {
      syncWaste = true;
    }
    if (cardEl.dataset.pile === PILE.FOUNDATION && cardEl.dataset.index !== undefined) {
      foundationIndexes.add(Number(cardEl.dataset.index));
    }
  });
  if (syncWaste) {
    syncWastePileDom(state);
  }
  foundationIndexes.forEach((index) => {
    syncFoundationPileDom(state, index);
  });
}

export async function playUndoAnimation(undoMove, before, restoredState) {
  if (prefersReducedMotion()) {
    return;
  }

  syncTableauColumnHeights();

  if (undoMove.type === 'to-waste') {
    const cardEl = document.querySelector(`#game-root [data-card-id="${undoMove.cardId}"]`);
    if (!cardEl) {
      return;
    }
    const fromRect = cardEl.getBoundingClientRect();
    const toRect = getPlayTargetRect(restoredState, PILE.WASTE, 0, undoMove.cardId);
    if (!toRect) {
      return;
    }
    setAnimating(true);
    try {
      mountFlyingCard(cardEl, fromRect);
      revealUndonePileTops(restoredState, [cardEl]);
      await flyDelta(cardEl, fromRect, toRect);
      cardEl.remove();
      gsap.set(cardEl, { clearProps: 'all' });
    } finally {
      setAnimating(false);
    }
    return;
  }

  const flights = [];
  const cardEls = new Map();
  document.querySelectorAll('#game-root .card').forEach((el) => {
    cardEls.set(el.dataset.cardId, el);
  });

  for (const [cardId, prevPos] of before.cardPositions) {
    const el = cardEls.get(cardId);
    const loc = locateCard(restoredState, cardId);
    if (!el || !loc) {
      continue;
    }
    const toRect = getPlayTargetRect(restoredState, loc.pile, loc.index ?? 0, cardId);
    if (!toRect) {
      continue;
    }
    const fromRect = {
      left: prevPos.x,
      top: prevPos.y,
      width: prevPos.width,
      height: prevPos.height,
    };
    const deltaX = Math.abs(fromRect.left - toRect.left);
    const deltaY = Math.abs(fromRect.top - toRect.top);
    if (deltaX < 0.5 && deltaY < 0.5) {
      continue;
    }
    flights.push({ cardEl: el, fromRect: el.getBoundingClientRect(), toRect });
  }

  await flyManyOnLayer(flights, {
    onMounted: () => revealUndonePileTops(restoredState, flights.map(({ cardEl }) => cardEl)),
  });
}

export function captureUndoContext() {
  const wasteCardEl = document.querySelector('.pile-waste .card');
  return {
    cardPositions: captureCardPositions(),
    wasteCardEl,
  };
}

export async function animateAutoCompleteMoves(restoredState, cardIds) {
  if (prefersReducedMotion()) {
    return;
  }

  const cardEls = new Map();
  const foundationRects = new Map();
  const retainedByFoundation = new Map();
  document.querySelectorAll('#game-root .card').forEach((el) => {
    cardEls.set(el.dataset.cardId, el);
  });

  const batchSize = 10;
  setAnimating(true);
  try {
    for (let start = 0; start < cardIds.length; start += batchSize) {
      const flights = [];
      cardIds.slice(start, start + batchSize).forEach((cardId) => {
        const el = cardEls.get(cardId);
        const foundationIndex = locateCard(restoredState, cardId)?.index ?? 0;
        let toRect = foundationRects.get(foundationIndex);
        if (!toRect) {
          toRect = getPlayTargetRect(
            restoredState,
            PILE.FOUNDATION,
            foundationIndex,
            cardId,
          );
          foundationRects.set(foundationIndex, toRect);
        }
        if (!el || !toRect) {
          return;
        }
        flights.push({
          cardEl: el,
          foundationIndex,
          fromRect: el.getBoundingClientRect(),
          toRect,
        });
      });

      await flyManyOnLayer(flights, {
        stagger: 0.012,
        manageAnimating: false,
        retain: true,
      });

      flights.forEach(({ cardEl, foundationIndex }) => {
        const previous = retainedByFoundation.get(foundationIndex);
        if (previous && previous !== cardEl) {
          previous.remove();
          gsap.set(previous, { clearProps: 'all' });
        }
        retainedByFoundation.set(foundationIndex, cardEl);
      });
    }
  } finally {
    setAnimating(false);
  }
}
