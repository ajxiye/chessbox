# ChessBox

**An Open Source Chess Website.**

ChessBox is a modern chess platform project focused on a calm, clear playing experience. The repository currently contains the first playable local chessboard experience. It is the foundation for the wider platform, not a finished Chess.com or Lichess replacement.

## Current features

- Legal chess moves and game-state rules powered by [chess.js](https://github.com/jhlywa/chess.js)
- Click-to-select and click-to-move
- Drag-and-drop with pointer support for mouse, pen, and touch
- Legal move and capture indicators
- Check, checkmate, stalemate, and draw status
- Pawn promotion choices (queen, rook, bishop, or knight)
- Move list, undo, new game, board flip, and FEN copy
- Responsive dark interface

## Stack

- [Next.js](https://nextjs.org/) App Router
- React and TypeScript
- [chess.js](https://github.com/jhlywa/chess.js) for chess rules and move validation
- CSS, without a utility-CSS framework

## Requirements

- Node.js 20.9 or newer
- npm

## Run locally

```bash
git clone https://github.com/ajxiye/chessbox.git
cd chessbox
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Useful commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Run the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Check TypeScript types |

## Project structure

```text
chessbox/
├── public/
│   └── chessbox-mark.svg
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── components/
│       ├── chess-game.tsx
│       └── chess-piece.tsx
├── .gitignore
├── eslint.config.mjs
├── next-env.d.ts
├── package.json
└── tsconfig.json
```

## Roadmap

The first milestone is a reliable board and local game experience. Future work can build on it with accounts, online matchmaking, puzzles, analysis, saved games, and accessibility improvements.

## Contributing

Issues and pull requests are welcome. Please keep changes focused, explain the behaviour being changed, and run the lint and type-check commands before opening a pull request.

## License

A license has not been selected yet. Until a `LICENSE` file is added, the source is publicly viewable but is not explicitly licensed for reuse or redistribution.
