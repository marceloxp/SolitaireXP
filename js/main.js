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
import { createDragHandlerManager, getTableauGroupElements } from './drag-handler.js';
import {
  createScoreState,
  registerMove,
  tickTimer,
} from './score.js';
import { clearSavedGame, loadGame, saveGame } from './storage.js';
import {
  getCardElements,
  getDropTargets,
  syncGameDom,
  syncFoundationPileDom,
  syncTableauColumnHeights,
  syncStockPileDom,
  syncWastePileDom,
  updateHud,
} from './render.js';
import { clearWinAnimation, playWinAnimation, showWinOverlay } from './win-animation.js';
import { initPwaInstall } from './pwa-install.js';
import { initPwaUpdate } from './pwa-update.js';
import { initSplash } from './splash.js';
import { applyTheme, getStoredThemeId, setTheme } from './themes.js';
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

// TEMP: preview all footer/menu action buttons — set to true to force-show hidden buttons
const PREVIEW_ALL_FOOTER_BUTTONS = false;

function previewAllFooterButtons() {
  if (!PREVIEW_ALL_FOOTER_BUTTONS) {
    return;
  }
  document.querySelector('#btn-continue').hidden = false;
  document.querySelector('#btn-install').hidden = false;
  document.querySelector('#btn-auto-complete').hidden = false;
  document.querySelector('#btn-undo').hidden = false;
}

let gameState = dealNewGame();
let scoreState = createScoreState();
let dragManager = null;
let timerId = null;
let won = false;
let history = [];
let isBusy = false;

const BUSY_BUTTON_IDS = [
  'btn-home',
  'btn-new-from-game',
  'btn-auto-complete',
  'btn-undo',
];

function setBusy(active) {
  isBusy = active;
  BUSY_BUTTON_IDS.forEach((id) => {
    const button = document.getElementById(id);
    if (button) {
      button.disabled = active;
    }
  });
  gameRoot.setAttribute('aria-busy', active ? 'true' : 'false');
}

async function runExclusive(action, skippedValue) {
  if (isBusy) {
    return skippedValue;
  }
  setBusy(true);
  try {
    return await action();
  } finally {
    setBusy(false);
  }
}

function updateMenuContinueButton() {
  const continueBtn = document.querySelector('#btn-continue');
  if (!continueBtn) {
    return;
  }
  const saved = loadGame();
  continueBtn.hidden = !(saved?.gameState && !saved.gameState.won);
  previewAllFooterButtons();
}

function boot() {
  applyTheme(getStoredThemeId());
  bindMenu();
  removeLegacyBestScore();
  lockOrientation();
  initPwaInstall();
  initPwaUpdate();
  exposeDevTools();
  updateMenuContinueButton();
  previewAllFooterButtons();
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

function bindThemePicker() {
  document.querySelectorAll('.theme-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      setTheme(btn.dataset.themeId);
    });
  });
}

function bindMenu() {
  bindThemePicker();
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
  document.querySelector('#btn-home').addEventListener('click', () => goHome());
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

function goHome() {
  if (isBusy) {
    return;
  }
  stopTimer();
  saveGame(gameState, scoreState);
  showScreen('menu');
  updateMenuContinueButton();
}

function startNewGame() {
  if (isBusy) {
    return;
  }
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
  dragLayer.innerHTML = '';

  syncGameDom(gameRoot, gameState, {
    onStockClick: handleStockClick,
  });
  updateHud(hud, scoreState, gameState);
  updateAutoCompleteButton();
  updateUndoButton();
  previewAllFooterButtons();
  saveGame(gameState, scoreState);

  if (!dragManager) {
    dragManager = createDragHandlerManager({
      getGameState: () => gameState,
      getDropTargets,
      getCardElements,
      onDropAttempt: handleDropAttempt,
      onCardClick: handleCardClick,
    });
  }
  dragManager.sync();
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
  if (won || !history.length || isBusy) {
    return;
  }
  return runExclusive(performUndo);
}

async function performUndo() {
  const snapshot = history.pop();
  const undoMove = detectUndoMove(gameState, snapshot.gameState);
  const before = captureUndoContext();

  gameState = snapshot.gameState;
  scoreState = snapshot.scoreState;

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
  if (won || isBusy) {
    return;
  }
  return runExclusive(performStockClick);
}

async function performStockClick() {
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

async function handleDropAttempt(args) {
  if (won || isBusy) {
    return false;
  }
  return runExclusive(() => performDropAttempt(args), false);
}

async function performDropAttempt({ cardId, source, target, groupEls }) {
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

  if (source.pile === PILE.WASTE) {
    syncWastePileDom(gameState);
  } else if (source.pile === PILE.FOUNDATION) {
    syncFoundationPileDom(gameState, source.index);
  }

  syncTableauColumnHeights();

  if (groupEls?.length) {
    const targetRects = getGroupTargetRects(gameState, source, target, cardId);
    await animateDragGroupOnLayer(groupEls, targetRects);
  }

  await refresh();
  await checkWin();
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
  await checkWin();
}

async function handleCardClick(cardId) {
  if (won || isBusy) {
    return;
  }
  return runExclusive(() => performCardClick(cardId));
}

async function performCardClick(cardId) {
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
  if (won || isBusy || !canAutoComplete(gameState)) {
    return;
  }
  return runExclusive(performAutoComplete);
}

async function performAutoComplete() {
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

  syncTableauColumnHeights();
  await animateAutoCompleteMoves(gameState, cardIds);
  await refresh();
  await checkWin();
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

  gameRoot.classList.add('is-winning');
  await playWinAnimation(gameRoot, gameState);
  showWinOverlay(app, () => startNewGame());
}

const DEV_SLOT = 'solitairexp-dev';

function exposeDevTools() {
  window.__solitaire = {
    save() {
      localStorage.setItem(DEV_SLOT, JSON.stringify({
        game: serializeState(gameState),
        score: JSON.stringify(scoreState),
      }));
      console.info('[SolitaireXP] Saved — run __solitaire.load() to restore.');
    },
    load() {
      const raw = localStorage.getItem(DEV_SLOT);
      if (!raw) {
        console.warn('[SolitaireXP] Nothing saved yet — run __solitaire.save() first.');
        return;
      }
      const slot = JSON.parse(raw);
      localStorage.setItem('solitairexp-game-state', slot.game);
      localStorage.setItem('solitairexp-score-state', slot.score);
      location.reload();
    },
    async previewWin() {
      clearWinAnimation();
      gameRoot.classList.add('is-winning');
      await playWinAnimation(gameRoot, gameState);
      showWinOverlay(app, () => {
        clearWinAnimation();
        refresh();
      });
    },
  };
  console.info('[SolitaireXP] Dev: __solitaire.save() | load() | previewWin()');
}

async function start() {
  try {
    boot();
    await initSplash();
  } catch (error) {
    console.error('[SolitaireXP] Boot failed:', error);
    document.querySelector('#splash')?.remove();
    document.body.classList.remove('is-booting', 'is-revealing');
    app.removeAttribute('inert');
    app.removeAttribute('aria-hidden');
  }
}

start();
