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
    <h2>Você venceu!</h2>
    <p>Paciência completa.</p>
    <button type="button" class="win-overlay-btn">Jogar novamente</button>
  `;
  overlay.querySelector('.win-overlay-btn').addEventListener('click', () => {
    onPlayAgain?.();
  });
  root.appendChild(overlay);
  return overlay;
}
