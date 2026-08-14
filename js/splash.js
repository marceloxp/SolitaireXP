const MIN_VISIBLE_MS = 1000;
const FADE_MS = 450;

function preloadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
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
    preloadImage('assets/icons/icon-192.png'),
    preloadImage('assets/cards/card_back.png'),
  ]);

  return Promise.all([waitMin, waitAssets]).then(() => new Promise((resolve) => {
    splash.classList.add('is-hiding');

    const finish = () => {
      splash.remove();
      document.body.classList.remove('is-booting');
      resolve();
    };

    splash.addEventListener('transitionend', (event) => {
      if (event.target === splash && event.propertyName === 'opacity') {
        finish();
      }
    }, { once: true });

    setTimeout(finish, FADE_MS + 80);
  }));
}
