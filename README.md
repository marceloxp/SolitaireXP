# SolitaireXP

Classic **Klondike solitaire** (Draw-1) in the browser — Windows 3.1 vibes, modern polish. No install required, no account, no ads.

**[Play now →](https://marceloxp.github.io/SolitaireXP/)**

## Features

- **Klondike (Draw-1)** — the solitaire most people picture when they hear “solitaire”
- **Drag or tap** — move cards by dragging, or tap a valid card/stack and the game plays it for you
- **Undo** — take back up to 3 moves
- **Auto-complete** — when every card is face-up and the stock is empty, finish the game in one tap
- **Win 3.1 scoring** — points, move count, and timer
- **Saves automatically** — close the tab and pick up where you left off
- **Works offline** — install as a PWA and play without a connection (Chromium browsers show an **Install app** button on the menu)
- **Portrait-friendly** — built for phones; desktop works great too

## How to play

Build four foundation piles (one per suit) from **Ace** to **King**.

| Area           | Rule                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------ |
| **Tableau**    | Descending rank, alternating colors. Only a **King** (or a valid King-led stack) can fill an empty column.   |
| **Stock**      | Tap to draw one card at a time into the waste pile. When the stock is empty, tap again to recycle the waste. |
| **Foundation** | Same suit, ascending from Ace.                                                                               |

**Tip:** Tap a face-up card or stack — if there is a legal move, the game makes it (foundation first, then tableau left to right).

## Run locally

ES modules and the service worker need a real HTTP server (not `file://`):

```bash
python3 -m http.server 8989
# or:
npx http-server -p 8989 -c-1
```

Open [http://localhost:8989](http://localhost:8989).

If you change JS or CSS, hard-refresh or clear the service worker cache — otherwise you may keep seeing an old build.

## Tech

Vanilla HTML, CSS, and JavaScript with [GSAP](https://gsap.com/) for animations. No build step, no framework, no backend. Game state lives in `localStorage`. Deployed on GitHub Pages.

Developer notes for contributors and AI agents: see [`AGENTS.md`](AGENTS.md).

## Credits

- **Game** — [MarceloXP](https://github.com/marceloxp) ❤️ Silvana
- **Cards** — *Casino Card Pack* by Moxica (playground)
- **Code** — written with Claude Sonnet 5 and Composer 2.5 on [Cursor](https://cursor.com/)

## License

Personal project. Card assets are subject to their own license (see the Casino pack). Source code: use and learn from it; star the repo if you enjoy the game.
