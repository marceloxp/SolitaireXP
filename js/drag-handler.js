import { locateCard, PILE } from './game-state.js';
import { TABLEAU_OFFSET } from './render.js';

export function attachDragHandlers({
  gameState,
  onDropAttempt,
  onCardClick,
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
      // O default do GSAP (true) sobe o z-index do elemento pressionado pra
      // cima de todos os irmãos assim que o "press" acontece — mesmo sem
      // arrasto real. Isso fazia uma carta no meio da pilha "pular" pra
      // frente das cartas seguintes num simples clique, e num arraste de
      // grupo colocava a carta "pega" acima das outras do próprio grupo,
      // bagunçando a ordem visual. O z-index de cada carta já é controlado
      // manualmente (`render.js`/`restoreGroup`), então desligamos o boost.
      zIndexBoost: false,
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
        // O offset em cascata (idx * TABLEAU_OFFSET) já foi aplicado como
        // "top" estático em moveGroupToDragLayer; aqui só replicamos o delta
        // bruto do arraste (dx/dy) pra mover o grupo em bloco. Somar o
        // offset de novo aqui fazia as cartas se afastarem verticalmente a
        // cada pixel arrastado.
        const dx = this.x;
        const dy = this.y;
        groupEls.slice(1).forEach((node) => {
          gsap.set(node, { x: dx, y: dy });
        });
      },
      onClick() {
        onCardClick?.(cardId);
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
