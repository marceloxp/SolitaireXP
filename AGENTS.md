# SolitaireXP — agent notes

Klondike (Draw-1) solitaire PWA: vanilla HTML/CSS/JS + GSAP (vendored, no build step). State in `localStorage`. GitHub Pages from `main` (repo root, no Jekyll).

## Project map

| Path | Role |
| --- | --- |
| `index.html` | Shell: menu + game (`body[data-screen]`). Loads `js/theme-palette.js` inline before modules for early theme/`theme-color`. Asset query `?v=` and `app-version` should stay in sync on release. |
| `js/theme-palette.js` | **Single source** for theme colors (`PALETTE`), `theme-color`, and CSS `--felt*` vars. `manifest.json` `theme_color` / `background_color` should match `PALETTE.default`. |
| `js/themes.js` | Theme ids, `setTheme` / `applyTheme`, card backs per theme. |
| `js/card.js` | Card helpers, `cardImagePath`, `preloadGameCardImages()` (all faces + active back). |
| `js/deck.js` | Shuffle / deal. |
| `js/game-state.js` | Rules and move validation (pure, no DOM). |
| `js/score.js` | Win 3.1 scoring. |
| `js/storage.js` | `localStorage` save/load. |
| `js/render.js` | `renderGame` (first paint), **`syncGameDom`** (incremental DOM), `syncWastePileDom` / `syncFoundationPileDom`, **`ensurePileSlot`** (persistent dashed slot under waste/foundation cards). |
| `js/drag-handler.js` | **`createDragHandlerManager`**: sync Draggable instances instead of recreating every `refresh()`. Drag groups on `#drag-layer`. On drag start from waste/foundation, call `ensurePileSlot`. On rejected drop, remove `peekEl`; on accepted drop, do not remove `peekEl` (may be reused after `refresh()`). |
| `js/move-animation.js` | Animations via `#drag-layer`; undo pile reveal via `revealUndonePileTops`. |
| `js/main.js` | Bootstrap, menu/game flow, undo, click moves, **`runExclusive` / `isBusy`** (one animated action at a time). |
| `js/splash.js` | Splash timing; waits for logo + **`preloadGameCardImages()`**. |
| `js/win-animation.js` | Win cascade + overlay. |
| `js/pwa-install.js` | Chromium install prompt (`#btn-install`). |
| `js/pwa-update.js` | Update banner when a new service worker is ready. |
| `css/style.css` | Layout, menu, felt, themes (runtime vars from palette). |
| `css/cards.css` | Card / pile positioning. |
| `service-worker.js` | Cache-first offline; **bump `CACHE_NAME` when `ASSETS` changes** (and usually bump `index.html` `?v=` + menu version on user-facing releases). |

## Rules of thumb

- Legality lives only in `game-state.js` — render/drag/animations ask it, never decide alone.
- **`refresh()`**: clear `#drag-layer`, **`syncGameDom`**, HUD/buttons, `dragManager.sync()` (does not kill all draggables each time).
- After animated moves: mount on `#drag-layer`, animate, then `refresh()` (or targeted `sync*PileDom` mid-flow when the top card leaves waste/foundation).
- Tableau column height: `syncTableauColumnHeights()` counts DOM cards only (not game state).
- Waste/foundation show one card in DOM; **`.pile-slot`** is always present for the dashed frame under cards.
- UI is English. About dedication names (**MarceloXP**, **Silvana**) are fixed.
- Dev console: `__solitaire.save()` / `load()` / `previewWin()` (see `main.js`).

## Local dev

```bash
python3 -m http.server 8989
```

Needs HTTP (not `file://`). After editing JS/CSS, unregister the service worker and clear caches or you may keep seeing old code.

**Phone on LAN IP:** `pwa-update.js` only registers the service worker on `https:` or `localhost` / `127.0.0.1` — not on raw `http://192.168.x.x`. Testing on a phone via PC IP often skips the SW (fewer cache surprises); use localhost on desktop or HTTPS if you need SW behavior.

## Game (implemented)

Draw-1 Klondike, drag, click-to-move, undo (max 3, `MAX_UNDO` in `main.js`), auto-complete, Win 3.1 scoring. GSAP vendored under `js/vendor/` for offline PWA. Themes: **Classic** (default), **Alice** (`assets/themes/alice/`).

## CSS gotcha

`[hidden]` loses to author `display: flex/grid` rules — explicit `element[hidden] { display: none; }` exists for `.toolbar button` and `.about-overlay`.

`theme-color` meta is updated in JS (`theme-palette.js` / `themes.js`); some mobile browsers only apply it after reload — not worth fighting per browser.
