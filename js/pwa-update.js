// Detect new service-worker versions and let the user reload when ready.

let registrationRef = null;
let bannerEl = null;
let listeningForReload = false;

function shouldRegisterServiceWorker() {
  const { hostname, protocol } = window.location;
  if (protocol === 'https:') {
    return true;
  }
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function hideUpdateBanner() {
  bannerEl?.remove();
  bannerEl = null;
}

function showUpdateBanner() {
  if (bannerEl) {
    return;
  }

  bannerEl = document.createElement('div');
  bannerEl.className = 'update-banner';
  bannerEl.setAttribute('role', 'alertdialog');
  bannerEl.setAttribute('aria-labelledby', 'update-banner-title');
  bannerEl.innerHTML = `
    <p id="update-banner-title" class="update-banner-text">A new version is available.</p>
    <div class="update-banner-actions">
      <button type="button" class="update-banner-later">Later</button>
      <button type="button" class="update-banner-apply">Update</button>
    </div>
  `;

  bannerEl.querySelector('.update-banner-later').addEventListener('click', hideUpdateBanner);
  bannerEl.querySelector('.update-banner-apply').addEventListener('click', applyUpdate);
  document.body.appendChild(bannerEl);
}

function applyUpdate() {
  if (!listeningForReload) {
    listeningForReload = true;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }

  const waiting = registrationRef?.waiting;
  if (waiting) {
    waiting.postMessage({ type: 'SKIP_WAITING' });
    return;
  }

  window.location.reload();
}

function watchForUpdates(registration) {
  registrationRef = registration;

  if (registration.waiting) {
    showUpdateBanner();
  }

  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    if (!worker) {
      return;
    }
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        showUpdateBanner();
      }
    });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      registration.update().catch(() => {});
    }
  });
}

function activateFirstInstall(registration) {
  const skip = () => {
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
  };

  if (registration.waiting) {
    skip();
  } else if (registration.installing) {
    registration.installing.addEventListener('statechange', () => {
      if (registration.installing?.state === 'installed') {
        skip();
      }
    });
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  }, { once: true });
}

async function registerServiceWorker() {
  try {
    const registration = await navigator.serviceWorker.register('./service-worker.js');
    registrationRef = registration;

    if (!navigator.serviceWorker.controller) {
      activateFirstInstall(registration);
      return;
    }

    watchForUpdates(registration);
  } catch {
    // offline or unsupported — ignore
  }
}

export function initPwaUpdate() {
  if (!('serviceWorker' in navigator) || !shouldRegisterServiceWorker()) {
    return;
  }
  window.addEventListener('load', () => {
    registerServiceWorker();
  });
}
