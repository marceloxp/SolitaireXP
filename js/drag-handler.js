import { locateCard, PILE } from './game-state.js';
import { TABLEAU_OFFSET } from './render.js';

export function attachDragHandlers({
  gameState,
  onDropAttempt,
  onDoubleTap,
  getDropTargets,
  getCardElements,
}) {
  const draggables = [];

  getCardElements().forEach((el) => {
    const cardId = el.dataset.cardId;
    const source = locateCard(gameState, cardId);
    if (!source) {
      return;
    }

    const groupEls = getDragGroupElements(el, source);
    const startPositions = new Map();
    let dragged = false;

    const draggable = Draggable.create(el, {
      type: 'x,y',
      inertia: false,
      zIndexBoost: true,
      onPress() {
        dragged = false;
        groupEls.forEach((node) => {
          startPositions.set(node, {
            parent: node.parentElement,
          });
        });
      },
      onDragStart() {
        dragged = true;
        groupEls.forEach((node) => node.classList.add('dragging'));
        moveGroupToDragLayer(groupEls);
      },
      onDrag() {
        const dx = this.x;
        const dy = this.y;
        groupEls.slice(1).forEach((node, idx) => {
          gsap.set(node, {
            x: dx,
            y: dy + (idx + 1) * TABLEAU_OFFSET,
          });
        });
      },
      onRelease() {
        if (!dragged) {
          startPositions.clear();
          return;
        }

        const dropTarget = findDropTarget(this.pointerEvent.clientX, this.pointerEvent.clientY, getDropTargets());
        const accepted = dropTarget
          ? onDropAttempt({
              cardId,
              source,
              target: parseDropTarget(dropTarget),
            })
          : false;

        if (!accepted) {
          restoreGroup(groupEls, startPositions);
        }

        groupEls.forEach((node) => node.classList.remove('dragging'));
        startPositions.clear();
        dragged = false;
      },
    })[0];

    let lastTap = 0;
    el.addEventListener('click', (event) => {
      const now = Date.now();
      if (now - lastTap < 350) {
        event.preventDefault();
        onDoubleTap?.(cardId);
      }
      lastTap = now;
    });

    draggables.push(draggable);
  });

  return () => {
    draggables.forEach((d) => d.kill());
  };
}

function getDragGroupElements(el, source) {
  if (source.pile !== PILE.TABLEAU) {
    return [el];
  }
  const column = el.parentElement;
  const startIndex = Number(el.dataset.cardIndex);
  return [...column.querySelectorAll('.card')].filter((node) => {
    return Number(node.dataset.cardIndex) >= startIndex;
  });
}

function moveGroupToDragLayer(groupEls) {
  const layer = document.querySelector('#drag-layer');
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
    });
  });
}

function restoreGroup(groupEls, startPositions) {
  groupEls.forEach((node) => {
    const original = startPositions.get(node);
    if (!original) {
      return;
    }
    original.parent.appendChild(node);
    gsap.set(node, { clearProps: 'transform,x,y,left,top,position' });
    node.style.zIndex = String(10 + Number(node.dataset.cardIndex || 0));
    if (node.dataset.cardIndex) {
      node.style.setProperty('--stack-offset', `${Number(node.dataset.cardIndex) * TABLEAU_OFFSET}px`);
    }
  });
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
