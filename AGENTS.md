# SolitaireXP — agent notes

Klondike (Draw-1) solitaire PWA: vanilla HTML/CSS/JS + GSAP (vendored, no build step). State in `localStorage`. GitHub Pages from `main` (repo root, no Jekyll).

## Project map

| Path                   | Role                                                             |
| ---------------------- | ---------------------------------------------------------------- |
| `index.html`           | Shell: menu + game (`body[data-screen]`)                         |
| `js/game-state.js`     | Rules and move validation (pure, no DOM)                         |
| `js/render.js`         | Full DOM rebuild on state change                                 |
| `js/drag-handler.js`   | GSAP Draggable wrapper                                           |
| `js/move-animation.js` | Move animations via `#drag-layer`                                |
| `js/main.js`           | Bootstrap, menu/game flow, undo, click moves                     |
| `js/win-animation.js`  | Win cascade + overlay                                            |
| `js/pwa-install.js`    | Chromium install prompt (`#btn-install`)                         |
| `service-worker.js`    | Cache-first offline; **bump `CACHE_NAME` when `ASSETS` changes** |

## Rules of thumb

- Legality lives only in `game-state.js` — render/drag/animations ask it, never decide alone.
- After animated moves: mount on `#drag-layer`, animate, then `refresh()` (full re-render).
- Tableau column height: `syncTableauColumnHeights()` counts DOM cards only (not game state).
- UI is English. About dedication names (**MarceloXP**, **Silvana**) are fixed.

## Local dev

```bash
python3 -m http.server 8989
```

Needs HTTP (not `file://`). After editing JS/CSS, unregister the service worker and clear caches or you may keep seeing old code.

## Game (implemented)

Draw-1 Klondike, drag, click-to-move, undo (max 3, `MAX_UNDO` in `main.js`), auto-complete, Win 3.1 scoring. GSAP vendored under `js/vendor/` for offline PWA.

## CSS gotcha

`[hidden]` loses to author `display: flex/grid` rules — explicit `element[hidden] { display: none; }` exists for `.toolbar button` and `.about-overlay`.
