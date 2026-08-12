import { serializeState, deserializeState } from './game-state.js';

const STORAGE_KEY = 'solitairexp-game-state';
const SCORE_KEY = 'solitairexp-score-state';

export function saveGame(gameState, scoreState) {
  try {
    localStorage.setItem(STORAGE_KEY, serializeState(gameState));
    localStorage.setItem(SCORE_KEY, JSON.stringify(scoreState));
  } catch {
    // best-effort
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const scoreRaw = localStorage.getItem(SCORE_KEY);
    if (!raw) {
      return null;
    }
    const gameState = deserializeState(raw);
    const scoreState = scoreRaw ? JSON.parse(scoreRaw) : null;
    if (!gameState) {
      return null;
    }
    return { gameState, scoreState };
  } catch {
    return null;
  }
}

export function clearSavedGame() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SCORE_KEY);
  } catch {
    // best-effort
  }
}
