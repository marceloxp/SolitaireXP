// Single source for theme colors. manifest.json theme_color/background_color
// should match PALETTE.default.themeColor.
(function (global) {
  const STORAGE_KEY = 'solitairexp-theme';

  const PALETTE = {
    default: {
      id: 'default',
      label: 'Classic',
      themeColor: '#0f6b3a',
      felt: '#0f6b3a',
      feltDark: '#0a4f2a',
      feltLight: '#159652',
      cardBack: 'assets/cards/card_back.png',
    },
    alice: {
      id: 'alice',
      label: 'Alice',
      themeColor: '#9e4570',
      felt: '#9e4570',
      feltDark: '#6b2d4d',
      feltLight: '#c45a88',
      cardBack: 'assets/themes/alice/card_back.jpg',
    },
  };

  function getPalette(id) {
    return PALETTE[id] || PALETTE.default;
  }

  function applyPreviewTokens(root) {
    const classic = PALETTE.default;
    const alice = PALETTE.alice;
    root.style.setProperty('--classic-felt', classic.felt);
    root.style.setProperty('--classic-felt-dark', classic.feltDark);
    root.style.setProperty('--classic-felt-light', classic.feltLight);
    root.style.setProperty('--alice-felt', alice.felt);
    root.style.setProperty('--alice-felt-dark', alice.feltDark);
    root.style.setProperty('--alice-felt-light', alice.feltLight);
  }

  function applyPaletteToDocument(id) {
    const palette = getPalette(id);
    const root = document.documentElement;

    if (palette.id === 'default') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', palette.id);
    }

    root.style.setProperty('--felt', palette.felt);
    root.style.setProperty('--felt-dark', palette.feltDark);
    root.style.setProperty('--felt-light', palette.feltLight);
    applyPreviewTokens(root);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', palette.themeColor);
    }

    return palette;
  }

  function getStoredThemeId() {
    try {
      const id = global.localStorage.getItem(STORAGE_KEY);
      if (id && PALETTE[id]) {
        return id;
      }
    } catch {
      // best-effort
    }
    return 'default';
  }

  global.SolitaireXPThemeRegistry = {
    STORAGE_KEY,
    PALETTE,
    getPalette,
    getStoredThemeId,
    applyPaletteToDocument,
  };
})(window);
