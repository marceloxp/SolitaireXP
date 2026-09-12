const registry = globalThis.SolitaireXPThemeRegistry;

const STORAGE_KEY = registry?.STORAGE_KEY ?? 'solitairexp-theme';
const PALETTE = registry?.PALETTE ?? {
  default: {
    id: 'default',
    label: 'Classic',
    themeColor: '#0f6b3a',
    cardBack: 'assets/cards/card_back.png',
  },
};

export const THEMES = Object.fromEntries(
  Object.entries(PALETTE).map(([id, entry]) => [id, { ...entry, id: entry.id ?? id }]),
);

export function getStoredThemeId() {
  if (registry?.getStoredThemeId) {
    return registry.getStoredThemeId();
  }
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

  if (registry?.applyPaletteToDocument) {
    registry.applyPaletteToDocument(theme.id);
  } else {
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
