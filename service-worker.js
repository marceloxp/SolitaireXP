const CACHE_NAME = 'solitairexp-v13';

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANK_LABELS = ['A', '02', '03', '04', '05', '06', '07', '08', '09', '10', 'J', 'Q', 'K'];
const CARD_ASSETS = SUITS.flatMap((suit) => RANK_LABELS.map((rank) => `./assets/cards/card_${suit}_${rank}.png`));

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/cards.css',
  './js/vendor/gsap.min.js',
  './js/vendor/Draggable.min.js',
  './js/card.js',
  './js/deck.js',
  './js/game-state.js',
  './js/score.js',
  './js/storage.js',
  './js/render.js',
  './js/drag-handler.js',
  './js/win-animation.js',
  './js/pwa-install.js',
  './js/main.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/cards/card_back.png',
  ...CARD_ASSETS,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => cached);
    }),
  );
});
