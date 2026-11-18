# ChessBox

**An Open Source Chess Website.**

ChessBox is a free, open-source chess playground designed to grow into a full chess platform. It runs as a static site on GitHub Pages, with game rules and the chess engine running in the visitor's browser.

## Playable features

- **Play vs Stockfish:** adjustable engine strength, choose White or Black, local WebAssembly engine
- **Local two-player:** pass-and-play on one device
- **Legal chess:** moves, castling, en passant, promotion, check, checkmate and draw detection through chess.js
- **Board interaction:** click-to-move, drag-and-drop, legal move dots, capture indicators, last-move highlights and board flipping
- **Move tools:** undo, move history, FEN copy, PGN copy, FEN import and PGN import
- **Analysis:** Stockfish principal variation and evaluation for the current position
- **Puzzles:** original mate-in-one exercises
- **Learn:** introductory lines for the Italian Game, Ruy Lopez, Queen's Gambit and London System

## What is not online yet

GitHub Pages serves static files. It cannot run the trusted server required for accounts, real-time matchmaking, ratings, chat, cloud game storage, or anti-cheat. Those features are not faked or simulated in this build. They need a separate backend and a clear hosting/privacy plan. Local games, puzzles and engine analysis work without an account.

## Tech

- Next.js App Router with static export
- React + TypeScript
- chess.js for chess rules
- Stockfish.js 19 lite single-threaded WebAssembly for computer play and analysis
- Plain CSS and Figtree

## Run locally

Requirements: Node.js 20.9+ and npm.

```bash
git clone https://github.com/ajxiye/chessbox.git
cd chessbox
npm install
npm run dev
```

Open http://localhost:3000.

The install/build scripts copy the Stockfish browser worker and WebAssembly file from the npm package into `public/engine`.

## Build for GitHub Pages

```bash
GITHUB_PAGES=true npm run build
```

The static website is generated in `out/`. The included GitHub Actions workflow builds and deploys the site to:

`https://ajxiye.github.io/chessbox/`

Every push to `main` triggers a new deployment. In GitHub, set **Settings → Pages → Build and deployment → Source → GitHub Actions** if it is not already selected.

## License

ChessBox's original code is licensed under the MIT License. Third-party components keep their own licences. Stockfish.js is GPL-3.0; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the notice generated beside the engine assets.

## Contributing

Issues and pull requests are welcome. Please run `npm run typecheck`, `npm run lint`, and `npm run build` before opening a pull request.
