const STORAGE_KEY = 'solitairexp-theme';

export const THEMES = {
  default: {
    id: 'default',
    label: 'Classic',
    cardBack: 'assets/cards/card_back.png',
    themeColor: '#0f6b3a',
  },
  alice: {
    id: 'alice',
    label: 'Alice',
    cardBack: 'assets/themes/alice/card_back.jpg',
    themeColor: '#9e4570',
  },
};

export function getStoredThemeId() {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    if (id && THEMES[id]) {
      return id;
    }
  } catch {
    // best-effort
  }
  return 'default';
}

let activeThemeId = getStoredThemeId();

export function getActiveTheme() {
  return THEMES[activeThemeId] || THEMES.default;
}

export function applyTheme(id) {
  const theme = THEMES[id] || THEMES.default;
  activeThemeId = theme.id;

  const root = document.documentElement;
  if (theme.id === 'default') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme.id);
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme.themeColor);
  }

  document.querySelectorAll('.theme-option').forEach((btn) => {
    const selected = btn.dataset.themeId === theme.id;
    btn.classList.toggle('is-active', selected);
    btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
}

export function setTheme(id) {
  if (!THEMES[id]) {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // best-effort
  }
  applyTheme(id);
}
