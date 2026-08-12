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
} from './game-state.js';
import { attachDragHandlers } from './drag-handler.js';
import {
  createScoreState,
  finalizeScore,
  registerMove,
  tickTimer,
} from './score.js';
import { clearSavedGame, loadGame, saveGame } from './storage.js';
import {
  getCardElements,
  getDropTargets,
  renderGame,
  updateHud,
} from './render.js';
import { clearWinAnimation, playWinAnimation, showWinOverlay } from './win-animation.js';

const app = document.querySelector('#app');
const hud = document.querySelector('#hud');
const gameRoot = document.querySelector('#game-root');
const dragLayer = document.querySelector('#drag-layer');

let gameState = dealNewGame();
let scoreState = createScoreState();
let detachDrag = null;
let timerId = null;
let won = false;

function boot() {
  bindMenu();
  const saved = loadGame();
  const continueBtn = document.querySelector('#btn-continue');
  continueBtn.hidden = !(saved?.gameState && !saved.gameState.won);
  showScreen('menu');
}

function bindMenu() {
  document.querySelector('#btn-new-game').addEventListener('click', () => startNewGame());
  document.querySelector('#btn-continue').addEventListener('click', () => {
    const saved = loadGame();
    if (saved?.gameState) {
      gameState = saved.gameState;
      scoreState = { ...createScoreState(), ...saved.scoreState, bestScore: createScoreState().bestScore };
      showScreen('game');
      refresh();
      startTimer();
    }
  });
  document.querySelector('#btn-new-from-game').addEventListener('click', () => startNewGame());
  document.querySelector('#btn-auto-complete').addEventListener('click', () => runAutoComplete());
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

function refresh() {
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
  saveGame(gameState, scoreState);

  detachDrag = attachDragHandlers({
    gameState,
    getDropTargets,
    getCardElements,
    onDropAttempt: handleDropAttempt,
    onDoubleTap: handleDoubleTap,
  });
}

function handleStockClick() {
  if (won) {
    return;
  }
  drawFromStock(gameState);
  refresh();
}

function handleDropAttempt({ cardId, source, target }) {
  if (won) {
    return false;
  }

  let result;
  if (target.pile === PILE.TABLEAU) {
    result = applyMoveToTableau(gameState, source, target.index);
    if (result.ok) {
      registerMove(scoreState, scoreTypeToTableau(source.pile));
      if (result.flipped) {
        registerMove(scoreState, 'reveal-tableau');
      }
      refresh();
      checkWin();
      return true;
    }
  }

  if (target.pile === PILE.FOUNDATION) {
    result = applyMoveToFoundation(gameState, source, target.index);
    if (result.ok) {
      registerMove(scoreState, scoreTypeToFoundation(source.pile));
      if (result.flipped) {
        registerMove(scoreState, 'reveal-tableau');
      }
      refresh();
      checkWin();
      return true;
    }
  }

  return false;
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

function handleDoubleTap(cardId) {
  if (won) {
    return;
  }
  const source = locateCard(gameState, cardId);
  const fromPile = source?.pile;
  const result = autoMoveToFoundation(gameState, cardId);
  if (result.ok) {
    registerMove(scoreState, scoreTypeToFoundation(fromPile));
    if (result.flipped) {
      registerMove(scoreState, 'reveal-tableau');
    }
    refresh();
    checkWin();
  }
}

function updateAutoCompleteButton() {
  const btn = document.querySelector('#btn-auto-complete');
  btn.hidden = !canAutoComplete(gameState);
}

function runAutoComplete() {
  if (won || !canAutoComplete(gameState)) {
    return;
  }

  const moves = getAutoCompleteMoves(gameState);
  moves.forEach((move) => {
    const source = locateCard(gameState, move.cardId);
    applyMoveToFoundation(gameState, source, move.foundationIndex);
    registerMove(scoreState, 'tableau-to-foundation');
  });
  refresh();
  checkWin();
}

async function checkWin() {
  if (!isGameWon(gameState)) {
    return;
  }
  won = true;
  gameState.won = true;
  stopTimer();
  finalizeScore(scoreState);
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

boot();
