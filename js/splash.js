import { preloadGameCardImages } from './card.js';

const MIN_VISIBLE_MS = 1000;
const FADE_MS = 450;
const HANDOFF_MS = 720;

function preloadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function finishSplash(splash) {
  splash.remove();
  document.body.classList.remove('is-booting');
}

function fadeSplash(splash) {
  return new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) {
        return;
      }
      finished = true;
      finishSplash(splash);
      resolve();
    };

    splash.classList.add('is-hiding');
    splash.addEventListener('transitionend', (event) => {
      if (event.target === splash && event.propertyName === 'opacity') {
        finish();
      }
    }, { once: true });

    setTimeout(finish, FADE_MS + 80);
  });
}

function animateLogoHandoff(splash) {
  const gsapApi = window.gsap;
  const splashLogo = splash.querySelector('.splash-logo');
  const menuLogo = document.querySelector('.menu-logo');

  if (!gsapApi || !splashLogo || !menuLogo) {
    return fadeSplash(splash);
  }

  if (prefersReducedMotion()) {
    finishSplash(splash);
    return Promise.resolve();
  }

  // Batch layout reads before cloning or changing styles.
  const fromRect = splashLogo.getBoundingClientRect();
  const toRect = menuLogo.getBoundingClientRect();
  if (!fromRect.width || !toRect.width) {
    return fadeSplash(splash);
  }

  return new Promise((resolve) => {
    const flyingLogo = splashLogo.cloneNode(true);
    flyingLogo.removeAttribute('alt');
    flyingLogo.setAttribute('aria-hidden', 'true');
    document.body.appendChild(flyingLogo);

    const deltaX = (toRect.left + (toRect.width / 2))
      - (fromRect.left + (fromRect.width / 2));
    const deltaY = (toRect.top + (toRect.height / 2))
      - (fromRect.top + (fromRect.height / 2));
    const targetScale = toRect.width / fromRect.width;
    let timeline = null;
    let fallbackTimer = null;
    let finished = false;

    const finish = () => {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(fallbackTimer);
      timeline?.kill();
      menuLogo.style.removeProperty('visibility');
      flyingLogo.remove();
      finishSplash(splash);
      resolve();
    };

    try {
      gsapApi.set(flyingLogo, {
        position: 'fixed',
        left: fromRect.left,
        top: fromRect.top,
        width: fromRect.width,
        height: fromRect.height,
        margin: 0,
        zIndex: 10001,
        pointerEvents: 'none',
        transformOrigin: '50% 50%',
        willChange: 'transform',
      });
      gsapApi.set(splashLogo, { visibility: 'hidden' });
      gsapApi.set(menuLogo, { visibility: 'hidden' });
      gsapApi.set(splash, { transition: 'none' });

      timeline = gsapApi.timeline({
        defaults: { ease: 'power2.inOut' },
        onComplete: finish,
      });
      timeline
        .addLabel('handoff', 0)
        .to(flyingLogo, {
          x: deltaX,
          y: deltaY,
          scale: targetScale,
          duration: HANDOFF_MS / 1000,
        }, 'handoff')
        .to(splash, {
          opacity: 0,
          duration: 0.4,
          ease: 'power1.inOut',
        }, 'handoff+=0.18');

      fallbackTimer = setTimeout(finish, HANDOFF_MS + 500);
    } catch (error) {
      console.warn('[SolitaireXP] Logo handoff failed; using splash fade.', error);
      timeline?.kill();
      flyingLogo.remove();
      splashLogo.style.removeProperty('visibility');
      menuLogo.style.removeProperty('visibility');
      splash.style.removeProperty('opacity');
      splash.style.removeProperty('transition');
      fadeSplash(splash).then(resolve);
    }
  });
}

export function initSplash() {
  const splash = document.querySelector('#splash');
  if (!splash) {
    return Promise.resolve();
  }

  const waitMin = new Promise((resolve) => {
    setTimeout(resolve, MIN_VISIBLE_MS);
  });

  const waitAssets = Promise.all([
    preloadImage('assets/logo.png'),
    preloadGameCardImages(),
  ]);

  return Promise.all([waitMin, waitAssets]).then(() => animateLogoHandoff(splash));
}
