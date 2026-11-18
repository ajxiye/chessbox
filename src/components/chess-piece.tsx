import type { PieceSymbol, Color } from "chess.js";

type ChessPieceProps = {
  type: PieceSymbol;
  color: Color;
  className?: string;
};

export function ChessPiece({ type, color, className = "" }: ChessPieceProps) {
  const isWhite = color === "w";
  const fill = isWhite ? "#F5F2E9" : "#30383F";
  const stroke = isWhite ? "#38434A" : "#F0EEE7";

  return (
    <svg
      className={"chess-piece " + className}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <g fill={fill} stroke={stroke} strokeWidth="2.15" strokeLinecap="round" strokeLinejoin="round">
        {type === "p" && (
          <>
            <circle cx="32" cy="17" r="7.2" />
            <path d="M26.5 26c.3 5.7-1.6 10.1-5.4 15.2h21.8C39.1 36.1 37.2 31.7 37.5 26Z" />
            <path d="M20.7 42.5h22.6l3.5 7.3H17.2Z" />
            <path d="M15 52h34v4H15z" />
          </>
        )}

        {type === "r" && (
          <>
            <path d="M14 10h9v8h5v-8h8v8h5v-8h9v14H14Z" />
            <path d="M18 25h28l-3.1 22H21.1Z" />
            <path d="M16 48h32l3 5H13Z" />
            <path d="M11 54h42v4H11z" />
          </>
        )}

        {type === "n" && (
          <>
            <path d="M17 51h34l2 6H12Z" />
            <path d="M20 49c1.4-7.1 3.4-12.5 2.1-19.4-1-5.5 1.1-10.8 6.8-16.2l1.7 7.2 5.5-5.8c8.6 4.4 13.1 11.6 12.2 20.2-.4 4.5 1.4 9.1 3.2 14Z" />
            <path d="M28.2 14.8c5.8.2 9.2 1.8 12.1 5.3l-7.4 2.1-3.3-1.1" fill="none" />
            <circle cx="37.5" cy="27.5" r="1.5" fill={stroke} stroke="none" />
          </>
        )}

        {type === "b" && (
          <>
            <path d="M32 9.5a5.8 5.8 0 0 1 5.8 5.8c0 3.4-2.4 5.5-5.8 7.6-3.4-2.1-5.8-4.2-5.8-7.6A5.8 5.8 0 0 1 32 9.5Z" />
            <path d="M28 23c-5.3 7-7.1 14.5-2.8 20.2h13.6C43.1 37.5 41.3 30 36 23Z" />
            <path d="m28.7 26.3 7.4 12.2" fill="none" />
            <path d="M20 44h24l4 7H16Z" />
            <path d="M12.5 52h39v5h-39z" />
          </>
        )}

        {type === "q" && (
          <>
            <circle cx="12" cy="13" r="3.5" />
            <circle cx="22" cy="9" r="3.5" />
            <circle cx="32" cy="13" r="3.5" />
            <circle cx="42" cy="9" r="3.5" />
            <circle cx="52" cy="13" r="3.5" />
            <path d="m13 18 5.4 25h27.2L51 18 41.8 27 32 18l-9.8 9Z" />
            <path d="M18 44h28l3 7H15Z" />
            <path d="M12 52h40v5H12z" />
          </>
        )}

        {type === "k" && (
          <>
            <path d="M29.5 7h5v8h7v5h-7v6h-5v-6h-7v-5h7Z" />
            <path d="M23 28c-5 6.5-5.7 12.3-2.1 17.2h22.2c3.6-4.9 2.9-10.7-2.1-17.2Z" />
            <path d="M18 46h28l4 6H14Z" />
            <path d="M11 53h42v5H11z" />
          </>
        )}
      </g>
    </svg>
  );
}
