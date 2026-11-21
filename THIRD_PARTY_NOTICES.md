# Third-party notices

| Component | Version | Licence | Source |
| --- | --- | --- | --- |
| Next.js | 16.x | MIT | https://github.com/vercel/next.js |
| React / React DOM | 19.x | MIT | https://github.com/facebook/react |
| chess.js | 1.x | BSD-2-Clause | https://github.com/jhlywa/chess.js |
| Stockfish.js | 19.0.1, lite single-threaded WASM | GPL-3.0 | https://github.com/nmrugg/stockfish.js/tree/v19.0.1 |
| Figtree | Google Fonts | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Figtree |

## Stockfish

Stockfish.js runs in a separate browser Web Worker and is distributed unmodified. Its source is available from the Stockfish.js project above. The upstream engine is https://github.com/official-stockfish/Stockfish.

Stockfish is licensed under GNU GPL version 3.0. The full licence text is at https://www.gnu.org/licenses/gpl-3.0.txt. A build-specific notice is copied into `public/engine/NOTICE.txt` beside the engine assets during installation/build.

ChessBox is an independent project and is not affiliated with or endorsed by the Stockfish developers.


## Chess piece artwork: CBurnett

ChessBox uses the CBurnett SVG piece artwork created by Colin M. L. Burnett. The SVG files are loaded from the pinned public Lichess source revision at runtime; ChessBox does not modify or re-host the artwork.

- Author: Colin M. L. Burnett (Cburnett)
- Source: https://github.com/lichess-org/lila/tree/b27e1b4b0c1cd55dc3f6a33d6503d337315b2ba5/public/piece/cburnett
- Upstream source licensing record: https://github.com/lichess-org/lila/blob/master/COPYING.md
- Licence: GNU General Public License, version 2 or later (GPL-2.0-or-later)
- Full licence text: https://www.gnu.org/licenses/old-licenses/gpl-2.0.txt

The CBurnett artwork is a separately licensed asset set. This notice does not relicense the ChessBox application code. ChessBox does not use or copy the Chessground board implementation; its board layout and interaction code are maintained independently.


## Lichess puzzle data

ChessBox fetches the daily training puzzle from the public Lichess API at https://lichess.org/api/puzzle/daily. Lichess states that its puzzle collection is in the public domain and the downloadable puzzle database is released under CC0. Puzzle positions and metadata are displayed from that public API.

- API documentation: https://lichess.org/api
- Public puzzle database and CC0 notice: https://database.lichess.org/#puzzles

ChessBox is independent and is not affiliated with Lichess.
