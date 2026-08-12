export const SCORE = {
  WASTE_TO_TABLEAU: 5,
  WASTE_TO_FOUNDATION: 10,
  TABLEAU_TO_FOUNDATION: 10,
  FOUNDATION_TO_TABLEAU: -15,
  REVEAL_TABLEAU: 5,
  TIME_PENALTY: -2,
};

export function createScoreState(initialScore = 0) {
  return {
    score: initialScore,
    elapsedSeconds: 0,
    idleSeconds: 0,
  };
}

export function registerMove(scoreState, moveType) {
  scoreState.idleSeconds = 0;
  switch (moveType) {
    case 'waste-to-tableau':
      scoreState.score += SCORE.WASTE_TO_TABLEAU;
      break;
    case 'waste-to-foundation':
      scoreState.score += SCORE.WASTE_TO_FOUNDATION;
      break;
    case 'tableau-to-foundation':
      scoreState.score += SCORE.TABLEAU_TO_FOUNDATION;
      break;
    case 'foundation-to-tableau':
      scoreState.score += SCORE.FOUNDATION_TO_TABLEAU;
      break;
    case 'reveal-tableau':
      scoreState.score += SCORE.REVEAL_TABLEAU;
      break;
    default:
      break;
  }
  if (scoreState.score < 0) {
    scoreState.score = 0;
  }
}

export function tickTimer(scoreState) {
  scoreState.elapsedSeconds += 1;
  scoreState.idleSeconds += 1;
  if (scoreState.idleSeconds >= 10) {
    scoreState.score += SCORE.TIME_PENALTY;
    scoreState.idleSeconds = 0;
    if (scoreState.score < 0) {
      scoreState.score = 0;
    }
  }
}

export function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function playSound(name) {
  void name;
}
