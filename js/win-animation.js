export function playWinAnimation(container) {
  const cards = [...container.querySelectorAll('.card')];
  if (!cards.length) {
    return Promise.resolve();
  }

  cards.forEach((card, index) => {
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

export function showWinOverlay(root) {
  const overlay = document.createElement('div');
  overlay.className = 'win-overlay';
  overlay.innerHTML = '<h2>Você venceu!</h2><p>Paciência completa.</p>';
  root.appendChild(overlay);
  return overlay;
}
