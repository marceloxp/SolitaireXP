import { locateCard, PILE } from './game-state.js';
import { TABLEAU_OFFSET, createCardElement, syncTableauColumnHeights } from './render.js';

export function attachDragHandlers({
  gameState,
  onDropAttempt,
  onCardClick,
  getDropTargets,
  getCardElements,
}) {
  const manager = createDragHandlerManager({
    getGameState: () => gameState,
    onDropAttempt,
    onCardClick,
    getDropTargets,
    getCardElements,
  });
  manager.sync();
  return manager.destroy;
}

export function createDragHandlerManager({
  getGameState,
  onDropAttempt,
  onCardClick,
  getDropTargets,
  getCardElements,
}) {
  const entries = new Map();

  const sync = () => {
    const activeElements = new Set(getCardElements());

    entries.forEach((entry, cardId) => {
      if (!activeElements.has(entry.el)) {
        entry.draggable.kill();
        entries.delete(cardId);
      }
    });

    activeElements.forEach((el) => {
      const cardId = el.dataset.cardId;
      const current = entries.get(cardId);
      if (current?.el === el) {
        return;
      }
      current?.draggable.kill();
      entries.set(cardId, {
        el,
        draggable: createDraggable(el, {
          getGameState,
          onDropAttempt,
          onCardClick,
          getDropTargets,
        }),
      });
    });
  };

  const destroy = () => {
    entries.forEach(({ draggable }) => draggable.kill());
    entries.clear();
  };

  return { sync, destroy };
}

function createDraggable(el, {
  getGameState,
  onDropAttempt,
  onCardClick,
  getDropTargets,
}) {
  const cardId = el.dataset.cardId;
  const startPositions = new Map();
  let source = null;
  let groupEls = [el];
  let dragGroup = null;
  let dragged = false;
  let peekEl = null;

  return Draggable.create(el, {
    type: 'x,y',
    inertia: false,
    zIndexBoost: false,
    onPress() {
      source = locateCard(getGameState(), cardId);
      groupEls = source ? getTableauGroupElements(el, source) : [el];
      dragged = false;
      groupEls.forEach((node) => {
        startPositions.set(node, {
          parent: node.parentElement,
        });
      });
    },
    onDragStart() {
      if (!source) {
        return;
      }
      dragged = true;
      groupEls.forEach((node) => node.classList.add('dragging'));
      peekEl = revealCardBeneath(getGameState(), source, startPositions.get(el)?.parent);
      dragGroup = moveGroupToDragLayer(groupEls);
    },
    onDrag() {
      if (!dragGroup) {
        return;
      }
      const dx = this.x;
      const dy = this.y;
      gsap.set(dragGroup, { x: dx, y: dy });
      gsap.set(el, { x: 0, y: 0 });
    },
    onClick() {
      onCardClick?.(cardId);
    },
    onRelease() {
      if (!dragged) {
        startPositions.clear();
        return;
      }

      const dropTarget = findDropTarget(
        this.pointerEvent.clientX,
        this.pointerEvent.clientY,
        getDropTargets(),
      );

      const finish = (accepted) => {
        if (!accepted) {
          peekEl?.remove();
          restoreGroup(groupEls, startPositions, dragGroup);
        } else {
          dragGroup?.remove();
        }
        peekEl = null;
        groupEls.forEach((node) => node.classList.remove('dragging'));
        startPositions.clear();
        dragGroup = null;
        dragged = false;
      };

      if (!dropTarget) {
        finish(false);
        return;
      }

      Promise.resolve(onDropAttempt({
        cardId,
        source,
        target: parseDropTarget(dropTarget),
        groupEls,
      })).then(finish);
    },
  })[0];
}

export function getTableauGroupElements(el, source) {
  if (source.pile !== PILE.TABLEAU) {
    return [el];
  }
  const column = el.parentElement;
  const startIndex = Number(el.dataset.cardIndex);
  return [...column.querySelectorAll('.card')].filter((node) => {
    return Number(node.dataset.cardIndex) >= startIndex;
  });
}

function revealCardBeneath(gameState, source, parent) {
  if (!parent) {
    return null;
  }
  const cards = getUnderlyingPile(gameState, source);
  if (!cards || cards.length < 2) {
    return null;
  }
  const beneath = cards[cards.length - 2];
  const node = createCardElement(beneath, {
    pile: source.pile,
    index: source.index,
  });
  node.style.pointerEvents = 'none';
  parent.appendChild(node);
  return node;
}

function getUnderlyingPile(gameState, source) {
  if (source.pile === PILE.FOUNDATION) {
    return gameState.foundations[source.index];
  }
  if (source.pile === PILE.WASTE) {
    return gameState.waste;
  }
  return null;
}

function moveGroupToDragLayer(groupEls) {
  const layer = document.querySelector('#drag-layer');
  const first = groupEls[0];
  const rect = first.getBoundingClientRect();
  const layerRect = layer.getBoundingClientRect();

  const group = document.createElement('div');
  group.className = 'drag-group';
  layer.appendChild(group);
  gsap.set(group, {
    position: 'absolute',
    left: rect.left - layerRect.left,
    top: rect.top - layerRect.top,
    width: rect.width,
    height: rect.height + Math.max(0, groupEls.length - 1) * TABLEAU_OFFSET,
    x: 0,
    y: 0,
    zIndex: 3000,
  });

  groupEls.forEach((node, idx) => {
    group.appendChild(node);
    gsap.set(node, {
      position: 'absolute',
      left: 0,
      top: idx * TABLEAU_OFFSET,
      x: 0,
      y: 0,
      zIndex: idx,
    });
  });
  syncTableauColumnHeights();
  return group;
}

function restoreGroup(groupEls, startPositions, dragGroup) {
  groupEls.forEach((node) => {
    const original = startPositions.get(node);
    if (!original) {
      return;
    }
    original.parent.appendChild(node);
    gsap.set(node, { clearProps: 'transform,x,y,left,top,position,zIndex' });
    node.style.zIndex = String(10 + Number(node.dataset.cardIndex || 0));
    if (node.dataset.cardIndex) {
      node.style.setProperty('--stack-offset', `${Number(node.dataset.cardIndex) * TABLEAU_OFFSET}px`);
    }
  });
  dragGroup?.remove();
  syncTableauColumnHeights();
}

function findDropTarget(x, y, targets) {
  for (const target of targets) {
    const rect = target.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return target;
    }
  }
  return null;
}

function parseDropTarget(el) {
  return {
    pile: el.dataset.pile,
    index: Number(el.dataset.index),
  };
}

export function flashInvalid(el) {
  gsap.fromTo(el, { x: -8 }, { x: 0, duration: 0.15, repeat: 3, yoyo: true });
}
