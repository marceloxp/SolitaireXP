import {
  PILE,
  applyMoveToFoundation,
  applyMoveToTableau,
  autoMoveToFoundation,
  canAutoComplete,
  dealNewGame,
  drawFromStock,
  getAutoCompleteMoves,
  isGameWon,
  locateCard,
  serializeState,
} from './game-state.js';
import { attachDragHandlers, getTableauGroupElements } from './drag-handler.js';
import {
  createScoreState,
  registerMove,
  tickTimer,
} from './score.js';
import { clearSavedGame, loadGame, saveGame } from './storage.js';
import {
  getCardElements,
  getDropTargets,
  renderGame,
  syncTableauColumnHeights,
  syncStockPileDom,
  syncWastePileDom,
  updateHud,
} from './render.js';
import { clearWinAnimation, playWinAnimation, showWinOverlay } from './win-animation.js';
import { initPwaInstall } from './pwa-install.js';
import { initSplash } from './splash.js';
import {
  animateAutoCompleteMoves,
  animateCardToTarget,
  animateDragGroupOnLayer,
  animateStockToWaste,
  animateWasteToPlay,
  animateWasteToStockUndo,
  captureUndoContext,
  detectUndoMove,
  getGroupTargetRects,
  getPlayTargetRect,
  mountFlyingCard,
  mountTableauGroupOnLayer,
  playUndoAnimation,
} from './move-animation.js';

const app = document.querySelector('#app');
const hud = document.querySelector('#hud');
const gameRoot = document.querySelector('#game-root');
const dragLayer = document.querySelector('#drag-layer');

const MAX_UNDO = 3;

let gameState = dealNewGame();
let scoreState = createScoreState();
let detachDrag = null;
let timerId = null;
let won = false;
let history = [];

function boot() {
  bindMenu();
  removeLegacyBestScore();
  lockOrientation();
  initPwaInstall();
  const saved = loadGame();
  const continueBtn = document.querySelector('#btn-continue');
  continueBtn.hidden = !(saved?.gameState && !saved.gameState.won);
  showScreen('menu');
}

function lockOrientation() {
  // Só funciona em PWA instalado (display standalone/fullscreen) ou em
  // fullscreen de verdade — a maioria dos navegadores ignora silenciosamente
  // fora desses contextos. O `manifest.json` (`orientation: "portrait"`) e o
  // overlay de "gire o aparelho" (`css/style.css`) são o que realmente cobre
  // o caso geral (aba de navegador comum).
  screen.orientation?.lock?.('portrait')?.catch(() => {});
}

function removeLegacyBestScore() {
  try {
    localStorage.removeItem('solitairexp-best-score');
  } catch {
    // best-effort
  }
}

function bindMenu() {
  document.querySelector('#btn-new-game').addEventListener('click', () => startNewGame());
  document.querySelector('#btn-continue').addEventListener('click', () => {
    const saved = loadGame();
    if (saved?.gameState) {
      gameState = saved.gameState;
      scoreState = { ...createScoreState(), ...saved.scoreState };
      history = [];
      showScreen('game');
      refresh();
      startTimer();
    }
  });
  document.querySelector('#btn-new-from-game').addEventListener('click', () => {
    confirmAction('Start a new game? Current progress will be lost.', () => startNewGame());
  });
  document.querySelector('#btn-auto-complete').addEventListener('click', () => runAutoComplete());
  document.querySelector('#btn-undo').addEventListener('click', () => handleUndo());
  bindAbout();
}

function bindAbout() {
  const overlay = document.querySelector('#about-overlay');
  const open = () => {
    overlay.hidden = false;
  };
  const close = () => {
    overlay.hidden = true;
  };
  document.querySelector('#btn-about').addEventListener('click', open);
  document.querySelector('#btn-about-close').addEventListener('click', close);
  document.querySelector('#btn-about-footer-close').addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      close();
    }
  });
}

function confirmAction(message, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-box">
      <p>${message}</p>
      <div class="confirm-actions">
        <button type="button" class="confirm-cancel">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          <span>No</span>
        </button>
        <button type="button" class="confirm-ok">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>Yes</span>
        </button>
      </div>
    </div>
  `;
  const close = () => overlay.remove();
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      close();
    }
  });
  overlay.querySelector('.confirm-cancel').addEventListener('click', close);
  overlay.querySelector('.confirm-ok').addEventListener('click', () => {
    close();
    onConfirm();
  });
  app.appendChild(overlay);
}

function showScreen(name) {
  document.body.dataset.screen = name;
}

function startNewGame() {
  stopTimer();
  clearWinAnimation();
  won = false;
  gameState = dealNewGame();
  scoreState = createScoreState();
  history = [];
  clearSavedGame();
  showScreen('game');
  refresh();
  startTimer();
}

function startTimer() {
  stopTimer();
  timerId = window.setInterval(() => {
    if (won) {
      return;
    }
    tickTimer(scoreState);
    updateHud(hud, scoreState, gameState);
    saveGame(gameState, scoreState);
  }, 1000);
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

async function refresh() {
  if (detachDrag) {
    detachDrag();
    detachDrag = null;
  }
  dragLayer.innerHTML = '';

  renderGame(gameRoot, gameState, {
    onStockClick: handleStockClick,
  });
  updateHud(hud, scoreState, gameState);
  updateAutoCompleteButton();
  updateUndoButton();
  saveGame(gameState, scoreState);

  detachDrag = attachDragHandlers({
    gameState,
    getDropTargets,
    getCardElements,
    onDropAttempt: handleDropAttempt,
    onCardClick: handleCardClick,
  });
}

function snapshotState() {
  return {
    gameState: JSON.parse(serializeState(gameState)),
    scoreState: { ...scoreState },
  };
}

function pushHistory(snapshot) {
  history.push(snapshot);
  if (history.length > MAX_UNDO) {
    history.shift();
  }
}

function updateUndoButton() {
  const btn = document.querySelector('#btn-undo');
  btn.hidden = won || !history.length;
}

async function handleUndo() {
  if (won || !history.length) {
    return;
  }
  const snapshot = history.pop();
  const undoMove = detectUndoMove(gameState, snapshot.gameState);
  const before = captureUndoContext();

  gameState = snapshot.gameState;
  scoreState = snapshot.scoreState;

  if (detachDrag) {
    detachDrag();
    detachDrag = null;
  }

  if (undoMove.type === 'stock-draw' && before.wasteCardEl) {
    const fromRect = before.wasteCardEl.getBoundingClientRect();
    const flying = before.wasteCardEl;
    mountFlyingCard(flying, fromRect);
    syncWastePileDom(gameState);
    syncStockPileDom(gameState);
    const stockEl = document.querySelector('.pile-stock');
    const toRect = (stockEl?.querySelector('.card') ?? stockEl)?.getBoundingClientRect();
    const card = gameState.stock[gameState.stock.length - 1];
    await animateWasteToStockUndo(flying, card, fromRect, toRect);
    await refresh();
    return;
  }

  await playUndoAnimation(undoMove, before, gameState);
  await refresh();
}

async function handleStockClick() {
  if (won) {
    return;
  }
  const snapshot = snapshotState();

  if (gameState.stock.length) {
    const stockCardEl = document.querySelector('.pile-stock .card');
    if (!stockCardEl) {
      return;
    }

    const fromRect = stockCardEl.getBoundingClientRect();
    const wastePile = document.querySelector('.pile-waste');
    const toRect = (wastePile.querySelector('.card') ?? wastePile).getBoundingClientRect();

    const result = drawFromStock(gameState);
    if (result.action !== 'draw') {
      return;
    }

    pushHistory(snapshot);
    const drawnCard = gameState.waste[gameState.waste.length - 1];

    if (detachDrag) {
      detachDrag();
      detachDrag = null;
    }

    mountFlyingCard(stockCardEl, fromRect);
    syncStockPileDom(gameState);
    await animateStockToWaste(stockCardEl, drawnCard, fromRect, toRect);
    await refresh();
    return;
  }

  if (!gameState.waste.length) {
    return;
  }

  const result = drawFromStock(gameState);
  if (result.action === 'recycle') {
    pushHistory(snapshot);
    await refresh();
  }
}

async function handleDropAttempt({ cardId, source, target, groupEls }) {
  if (won) {
    return false;
  }

  const snapshot = snapshotState();
  let result;

  if (target.pile === PILE.TABLEAU) {
    result = applyMoveToTableau(gameState, source, target.index);
  } else if (target.pile === PILE.FOUNDATION) {
    result = applyMoveToFoundation(gameState, source, target.index);
  } else {
    return false;
  }

  if (!result.ok) {
    return false;
  }

  pushHistory(snapshot);
  registerMove(
    scoreState,
    target.pile === PILE.TABLEAU
      ? scoreTypeToTableau(source.pile)
      : scoreTypeToFoundation(source.pile),
  );
  if (result.flipped) {
    registerMove(scoreState, 'reveal-tableau');
  }

  if (detachDrag) {
    detachDrag();
    detachDrag = null;
  }

  if (source.pile === PILE.WASTE) {
    syncWastePileDom(gameState);
  }

  syncTableauColumnHeights();

  if (groupEls?.length) {
    const targetRects = getGroupTargetRects(gameState, source, target, cardId);
    await animateDragGroupOnLayer(groupEls, targetRects);
  }

  await refresh();
  checkWin();
  return true;
}

function scoreTypeToTableau(fromPile) {
  if (fromPile === PILE.FOUNDATION) {
    return 'foundation-to-tableau';
  }
  if (fromPile === PILE.WASTE) {
    return 'waste-to-tableau';
  }
  return 'tableau-move';
}

function scoreTypeToFoundation(fromPile) {
  if (fromPile === PILE.WASTE) {
    return 'waste-to-foundation';
  }
  return 'tableau-to-foundation';
}

async function finishClickMove({
  snapshot,
  cardEl,
  cardId,
  fromPile,
  scoreType,
  flipped,
  groupEls,
  target,
}) {
  const fromRect = cardEl.getBoundingClientRect();

  pushHistory(snapshot);
  registerMove(scoreState, scoreType);
  if (flipped) {
    registerMove(scoreState, 'reveal-tableau');
  }

  if (detachDrag) {
    detachDrag();
    detachDrag = null;
  }

  if (fromPile === PILE.WASTE) {
    mountFlyingCard(cardEl, fromRect);
    syncWastePileDom(gameState);
    const located = locateCard(gameState, cardId);
    const toRect = getPlayTargetRect(gameState, located.pile, located.index ?? 0, cardId);
    await animateWasteToPlay(cardEl, fromRect, toRect);
  } else if (target?.pile === PILE.TABLEAU && groupEls?.length) {
    mountTableauGroupOnLayer(groupEls);
    syncTableauColumnHeights();
    const targetRects = getGroupTargetRects(gameState, null, target, cardId);
    await animateDragGroupOnLayer(groupEls, targetRects);
  } else {
    mountFlyingCard(cardEl, fromRect);
    syncTableauColumnHeights();
    const located = locateCard(gameState, cardId);
    const toRect = getPlayTargetRect(gameState, located.pile, located.index ?? 0, cardId);
    await animateCardToTarget(cardEl, fromRect, toRect);
  }

  await refresh();
  checkWin();
}

async function handleCardClick(cardId) {
  if (won) {
    return;
  }
  const source = locateCard(gameState, cardId);
  const fromPile = source?.pile;
  const snapshot = snapshotState();
  const cardEl = document.querySelector(`#game-root [data-card-id="${cardId}"]`);
  if (!cardEl) {
    return;
  }

  const groupEls = source?.pile === PILE.TABLEAU
    ? getTableauGroupElements(cardEl, source)
    : [cardEl];

  const foundationResult = autoMoveToFoundation(gameState, cardId);
  if (foundationResult.ok) {
    await finishClickMove({
      snapshot,
      cardEl,
      cardId,
      fromPile,
      scoreType: scoreTypeToFoundation(fromPile),
      flipped: foundationResult.flipped,
      groupEls: [cardEl],
    });
    return;
  }

  if (!source || fromPile === PILE.FOUNDATION) {
    return;
  }

  for (let i = 0; i < gameState.tableau.length; i += 1) {
    const tableauResult = applyMoveToTableau(gameState, source, i);
    if (tableauResult.ok) {
      await finishClickMove({
        snapshot,
        cardEl,
        cardId,
        fromPile,
        scoreType: scoreTypeToTableau(fromPile),
        flipped: tableauResult.flipped,
        groupEls,
        target: { pile: PILE.TABLEAU, index: i },
      });
      return;
    }
  }
}

function updateAutoCompleteButton() {
  const btn = document.querySelector('#btn-auto-complete');
  btn.hidden = !canAutoComplete(gameState);
}

async function runAutoComplete() {
  if (won || !canAutoComplete(gameState)) {
    return;
  }

  const moves = getAutoCompleteMoves(gameState);
  if (!moves.length) {
    return;
  }

  const snapshot = snapshotState();
  const cardIds = moves.map((move) => move.cardId);

  moves.forEach((move) => {
    const source = locateCard(gameState, move.cardId);
    applyMoveToFoundation(gameState, source, move.foundationIndex);
    registerMove(scoreState, 'tableau-to-foundation');
  });
  pushHistory(snapshot);

  if (detachDrag) {
    detachDrag();
    detachDrag = null;
  }

  syncTableauColumnHeights();
  await animateAutoCompleteMoves(gameState, cardIds);
  await refresh();
  checkWin();
}

async function checkWin() {
  if (!isGameWon(gameState)) {
    return;
  }
  won = true;
  gameState.won = true;
  stopTimer();
  updateHud(hud, scoreState, gameState);
  saveGame(gameState, scoreState);

  await playWinAnimation(gameRoot);
  showWinOverlay(app, () => startNewGame());
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}

async function start() {
  await initSplash();
  boot();
}

start();
