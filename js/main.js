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
import { attachDragHandlers } from './drag-handler.js';
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
  updateHud,
} from './render.js';
import { clearWinAnimation, playWinAnimation, showWinOverlay } from './win-animation.js';

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
    confirmAction('Começar um novo jogo? O progresso atual será perdido.', () => startNewGame());
  });
  document.querySelector('#btn-auto-complete').addEventListener('click', () => runAutoComplete());
  document.querySelector('#btn-undo').addEventListener('click', () => handleUndo());
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
          <span>Cancelar</span>
        </button>
        <button type="button" class="confirm-ok">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>Confirmar</span>
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

function handleUndo() {
  if (won || !history.length) {
    return;
  }
  const snapshot = history.pop();
  gameState = snapshot.gameState;
  scoreState = snapshot.scoreState;
  refresh();
}

function handleStockClick() {
  if (won) {
    return;
  }
  const snapshot = snapshotState();
  const result = drawFromStock(gameState);
  if (result.action !== 'none') {
    pushHistory(snapshot);
  }
  refresh();
}

function handleDropAttempt({ cardId, source, target }) {
  if (won) {
    return false;
  }

  const snapshot = snapshotState();

  let result;
  if (target.pile === PILE.TABLEAU) {
    result = applyMoveToTableau(gameState, source, target.index);
    if (result.ok) {
      pushHistory(snapshot);
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
      pushHistory(snapshot);
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

function handleCardClick(cardId) {
  if (won) {
    return;
  }
  const source = locateCard(gameState, cardId);
  const fromPile = source?.pile;
  const snapshot = snapshotState();

  const foundationResult = autoMoveToFoundation(gameState, cardId);
  if (foundationResult.ok) {
    pushHistory(snapshot);
    registerMove(scoreState, scoreTypeToFoundation(fromPile));
    if (foundationResult.flipped) {
      registerMove(scoreState, 'reveal-tableau');
    }
    refresh();
    checkWin();
    return;
  }

  if (!source || fromPile === PILE.FOUNDATION) {
    return;
  }

  for (let i = 0; i < gameState.tableau.length; i += 1) {
    const tableauResult = applyMoveToTableau(gameState, source, i);
    if (tableauResult.ok) {
      pushHistory(snapshot);
      registerMove(scoreState, scoreTypeToTableau(fromPile));
      if (tableauResult.flipped) {
        registerMove(scoreState, 'reveal-tableau');
      }
      refresh();
      checkWin();
      return;
    }
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
  if (!moves.length) {
    return;
  }

  const snapshot = snapshotState();
  moves.forEach((move) => {
    const source = locateCard(gameState, move.cardId);
    applyMoveToFoundation(gameState, source, move.foundationIndex);
    registerMove(scoreState, 'tableau-to-foundation');
  });
  pushHistory(snapshot);
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
