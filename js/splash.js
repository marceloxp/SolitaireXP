import { preloadGameCardImages } from './card.js';
import { getActiveTheme } from './themes.js';

const FIRST_VISIT_MIN_MS = 600;
const WARM_VISIT_MIN_MS = 350;
const FADE_MS = 350;
const ASSET_TIMEOUT_MS = 4000;
const SEEN_KEY = 'solitairexp-splash-seen';

function waitForImage(img) {
  return new Promise((resolve) => {
    let settled = false;
    const timeoutId = setTimeout(done, ASSET_TIMEOUT_MS);

    function done() {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      img.onload = null;
      img.onerror = null;
      resolve();
    }

    function decodeThenDone() {
      if (typeof img.decode === 'function') {
        img.decode().catch(() => {}).finally(done);
        return;
      }
      done();
    }

    if (img.complete) {
      decodeThenDone();
      return;
    }

    img.onload = decodeThenDone;
    img.onerror = done;
  });
}

function preloadImage(src) {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  return waitForImage(img);
}

function hasSeenSplash() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === 'true';
  } catch {
    return false;
  }
}

function rememberSplash() {
  try {
    sessionStorage.setItem(SEEN_KEY, 'true');
  } catch {
    // best-effort
  }
}

export function initSplash() {
  const splash = document.querySelector('#splash');
  if (!splash) {
    const app = document.querySelector('#app');
    document.body.classList.remove('is-booting', 'is-revealing');
    app?.removeAttribute('inert');
    app?.removeAttribute('aria-hidden');
    return Promise.resolve();
  }

  const app = document.querySelector('#app');
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const minVisibleMs = reducedMotion
    ? 0
    : (hasSeenSplash() ? WARM_VISIT_MIN_MS : FIRST_VISIT_MIN_MS);
  const waitMin = new Promise((resolve) => {
    setTimeout(resolve, minVisibleMs);
  });

  const logo = splash.querySelector('.splash-logo');
  const waitCriticalAssets = Promise.all([
    logo ? waitForImage(logo) : preloadImage('assets/logo.png'),
    preloadImage(getActiveTheme().cardBack),
  ]);

  // Faces continue loading while the menu is usable; only assets needed for
  // the opening view are allowed to hold the splash.
  waitCriticalAssets.then(() => preloadGameCardImages());

  return Promise.all([waitMin, waitCriticalAssets]).then(() => new Promise((resolve) => {
    document.body.classList.add('is-revealing');
    splash.classList.add('is-hiding');

    let finished = false;
    const finish = () => {
      if (finished) {
        return;
      }
      finished = true;
      splash.remove();
      document.body.classList.remove('is-booting', 'is-revealing');
      app?.removeAttribute('inert');
      app?.removeAttribute('aria-hidden');
      rememberSplash();
      resolve();
    };

    splash.addEventListener('transitionend', (event) => {
      if (event.target === splash && event.propertyName === 'opacity') {
        finish();
      }
    }, { once: true });

    setTimeout(finish, reducedMotion ? 30 : FADE_MS + 80);
  }));
}
