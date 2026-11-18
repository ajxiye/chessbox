import type { PieceSymbol, Color } from "chess.js";

type ChessPieceProps = {
  type: PieceSymbol;
  color: Color;
  className?: string;
};

/**
 * CBurnett piece artwork by Colin M. L. Burnett.
 * The artwork is served from the pinned Lichess source revision and remains
 * under GPL-2.0-or-later. See THIRD_PARTY_NOTICES.md.
 */
const LICHESS_PIECE_REVISION = "b27e1b4b0c1cd55dc3f6a33d6503d337315b2ba5";

export function ChessPiece({ type, color, className = "" }: ChessPieceProps) {
  const pieceCode = color + type.toUpperCase();
  const source = `https://raw.githubusercontent.com/lichess-org/lila/${LICHESS_PIECE_REVISION}/public/piece/cburnett/${pieceCode}.svg`;

  return (
    <img
      className={"chess-piece " + className}
      src={source}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
    />
  );
}
