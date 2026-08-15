export function playWinAnimation(container) {
  const cards = [...container.querySelectorAll('.card')];
  if (!cards.length) {
    return Promise.resolve();
  }

  cards.forEach((card, index) => {
    card.classList.add('win-flying-card');
    gsap.set(card, {
      position: 'fixed',
      left: card.getBoundingClientRect().left,
      top: card.getBoundingClientRect().top,
      zIndex: 1000 + index,
    });
    document.body.appendChild(card);
  });

  return gsap.to(cards, {
    duration: 1.4,
    stagger: 0.03,
    ease: 'bounce.out',
    x: () => gsap.utils.random(-120, 120),
    y: () => gsap.utils.random(-180, -40),
    rotation: () => gsap.utils.random(-25, 25),
  });
}

export function clearWinAnimation() {
  document.querySelectorAll('.win-flying-card').forEach((el) => el.remove());
  document.querySelectorAll('.win-overlay').forEach((el) => el.remove());
}

export function showWinOverlay(root, onPlayAgain) {
  const overlay = document.createElement('div');
  overlay.className = 'win-overlay';
  overlay.innerHTML = `
    <h2>You win!</h2>
    <p>Game complete.</p>
    <button type="button" class="win-overlay-btn">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
      <span>Play again</span>
    </button>
  `;
  overlay.querySelector('.win-overlay-btn').addEventListener('click', () => {
    onPlayAgain?.();
  });
  root.appendChild(overlay);
  return overlay;
}
