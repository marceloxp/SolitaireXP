import { PILE } from './game-state.js';
import { createCardElement } from './render.js';

const DEV_BACKDROP_CLASS = 'win-celebration-backdrop';

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function measureCardSize(container) {
  const sample = container.querySelector('.card');
  if (sample) {
    const rect = sample.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return { width: rect.width, height: rect.height };
    }
  }
  return { width: 72, height: 100 };
}

function mountWinBackdrop() {
  let backdrop = document.querySelector(`.${DEV_BACKDROP_CLASS}`);
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = DEV_BACKDROP_CLASS;
    document.body.appendChild(backdrop);
  }
  gsap.set(backdrop, { opacity: 0 });
  gsap.to(backdrop, { opacity: 1, duration: 0.45, ease: 'power1.out' });
  return backdrop;
}

function buildFoundationFlyingCards(gameState, container) {
  const piles = [...container.querySelectorAll('.pile-foundation')];
  const size = measureCardSize(container);
  const flying = [];

  gameState.foundations.forEach((pile, foundationIndex) => {
    const pileRect = piles[foundationIndex]?.getBoundingClientRect();
    if (!pileRect) {
      return;
    }

    pile.forEach((card, stackIndex) => {
      const el = createCardElement(card, {
        pile: PILE.FOUNDATION,
        index: foundationIndex,
        draggable: false,
      });
      el.classList.add('win-flying-card');
      document.body.appendChild(el);

      gsap.set(el, {
        position: 'fixed',
        left: pileRect.left,
        top: pileRect.top,
        width: size.width,
        height: size.height,
        x: 0,
        y: -stackIndex * 2,
        zIndex: 1800 + foundationIndex * 20 + stackIndex,
        transformOrigin: '50% 85%',
        rotation: 0,
        scale: 1,
      });

      flying.push({ el, foundationIndex, rank: card.rank, stackIndex });
    });
  });

  return flying;
}

function orderCardsRoundRobin(flying) {
  const ordered = [];
  for (let rank = 1; rank <= 13; rank += 1) {
    for (let foundationIndex = 0; foundationIndex < 4; foundationIndex += 1) {
      const match = flying.find((item) => item.foundationIndex === foundationIndex && item.rank === rank);
      if (match) {
        ordered.push(match);
      }
    }
  }
  return ordered.length ? ordered : flying;
}

function fanTarget(index, total, cardSize) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cx = vw / 2;
  const cy = vh * 0.44;
  const t = total <= 1 ? 0.5 : index / (total - 1);
  const angle = -Math.PI * 0.62 + t * Math.PI * 1.24;
  const radius = Math.min(vw, vh) * 0.34;

  return {
    left: cx + Math.cos(angle) * radius - cardSize.width / 2,
    top: cy + Math.sin(angle) * radius * 0.5 - cardSize.height / 2,
    rotation: (angle * 180) / Math.PI * 0.18,
  };
}

export function playWinAnimation(container, gameState) {
  const flying = gameState?.foundations
    ? buildFoundationFlyingCards(gameState, container)
    : [];

  if (!flying.length) {
    const fallback = [...container.querySelectorAll('.card')];
    if (!fallback.length) {
      return Promise.resolve();
    }

    fallback.forEach((card, index) => {
      card.classList.add('win-flying-card');
      const rect = card.getBoundingClientRect();
      gsap.set(card, {
        position: 'fixed',
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        x: 0,
        y: 0,
        zIndex: 1800 + index,
        transformOrigin: '50% 85%',
      });
      document.body.appendChild(card);
    });

    mountWinBackdrop();
    return gsap.to(fallback, {
      duration: 0.8,
      stagger: 0.04,
      y: -120,
      rotation: () => gsap.utils.random(-20, 20),
      ease: 'power2.out',
    });
  }

  mountWinBackdrop();
  container.classList.add('is-winning');

  const ordered = orderCardsRoundRobin(flying);
  const cardSize = measureCardSize(container);
  const tl = gsap.timeline();

  if (prefersReducedMotion()) {
    ordered.forEach((item, index) => {
      const target = fanTarget(index, ordered.length, cardSize);
      const startLeft = gsap.getProperty(item.el, 'left');
      const startTop = gsap.getProperty(item.el, 'top');
      gsap.set(item.el, {
        left: target.left,
        top: target.top,
        rotation: target.rotation,
        x: 0,
        y: 0,
        zIndex: 2000 + index,
      });
    });
    return tl.to({}, { duration: 0.35 });
  }

  ordered.forEach((item, index) => {
    const target = fanTarget(index, ordered.length, cardSize);
    const startLeft = Number(gsap.getProperty(item.el, 'left'));
    const startTop = Number(gsap.getProperty(item.el, 'top'));
    const dx = target.left - startLeft;
    const dy = target.top - startTop;
    const launch = index * 0.032;

    tl.to(item.el, {
      duration: 0.18,
      y: '-=36',
      scale: 1.06,
      ease: 'power2.out',
    }, launch);

    tl.to(item.el, {
      duration: 0.62,
      x: dx,
      y: dy - 28,
      rotation: target.rotation,
      scale: 1,
      ease: 'power2.inOut',
      zIndex: 2000 + index,
    }, launch + 0.08);

    tl.to(item.el, {
      duration: 0.28,
      y: `+=${28}`,
      ease: 'bounce.out',
    }, launch + 0.62);
  });

  tl.to(ordered.map((item) => item.el), {
    duration: 0.22,
    scale: 1.05,
    y: '-=6',
    ease: 'power2.out',
    stagger: 0.01,
  }, '+=0.08');

  tl.to(ordered.map((item) => item.el), {
    duration: 0.35,
    scale: 1,
    y: '+=6',
    ease: 'bounce.out',
    stagger: 0.01,
  }, '<0.12');

  return tl;
}

export function clearWinAnimation() {
  document.querySelectorAll('.win-flying-card').forEach((el) => el.remove());
  document.querySelectorAll('.win-overlay').forEach((el) => el.remove());
  document.querySelector(`.${DEV_BACKDROP_CLASS}`)?.remove();
  document.querySelector('#game-root')?.classList.remove('is-winning');
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
  gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power2.out' });
  return overlay;
}
