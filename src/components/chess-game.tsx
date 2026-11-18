"use client";

import { useMemo, useRef, useState } from "react";
import { Chess, type Color, type Move, type PieceSymbol, type Square } from "chess.js";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ChessPiece } from "@/components/chess-piece";

type DragState = { from: Square; x: number; y: number };
type PromotionState = { from: Square; to: Square; color: Color };
type BoardOrientation = "w" | "b";

const promotionOptions: { value: PieceSymbol; label: string }[] = [
  { value: "q", label: "Queen" },
  { value: "r", label: "Rook" },
  { value: "b", label: "Bishop" },
  { value: "n", label: "Knight" },
];

function pieceName(type: PieceSymbol) {
  const names: Record<PieceSymbol, string> = {
    p: "pawn",
    n: "knight",
    b: "bishop",
    r: "rook",
    q: "queen",
    k: "king",
  };
  return names[type];
}

function sideName(color: Color) {
  return color === "w" ? "White" : "Black";
}

export function ChessGame() {
  const gameRef = useRef(new Chess());
  const [, setRevision] = useState(0);
  const [orientation, setOrientation] = useState<BoardOrientation>("w");
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<PromotionState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<{ from: Square; pointerId: number } | null>(null);
  const suppressClickRef = useRef(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  const game = gameRef.current;
  const history = game.history({ verbose: true });
  const lastMove = history.length ? history[history.length - 1] : null;
  const legalMoves = useMemo(
    () => selected ? game.moves({ square: selected, verbose: true }) as Move[] : [],
    // The revision is the intentional signal that the chess.js instance changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, game, history.length, game.fen()],
  );
  const legalTargets = new Set(legalMoves.map((move) => move.to));
  const captureTargets = new Set(
    legalMoves.filter((move) => move.captured || move.isEnPassant()).map((move) => move.to),
  );
  const checkSquare = game.isCheck()
    ? game.findPiece({ type: "k", color: game.turn() })[0] as Square | undefined
    : undefined;

  let statusTitle = sideName(game.turn()) + " to move";
  let statusDetail = game.isCheck() ? "King in check" : "Game in progress";
  let gameOver = false;

  if (game.isCheckmate()) {
    statusTitle = sideName(game.turn() === "w" ? "b" : "w") + " wins";
    statusDetail = "Checkmate";
    gameOver = true;
  } else if (game.isStalemate()) {
    statusTitle = "Draw";
    statusDetail = "Stalemate";
    gameOver = true;
  } else if (game.isThreefoldRepetition()) {
    statusTitle = "Draw";
    statusDetail = "Threefold repetition";
    gameOver = true;
  } else if (game.isInsufficientMaterial()) {
    statusTitle = "Draw";
    statusDetail = "Insufficient material";
    gameOver = true;
  } else if (game.isDraw()) {
    statusTitle = "Draw";
    statusDetail = "Draw by the fifty-move rule";
    gameOver = true;
  }

  const movePairs: { number: number; white?: Move; black?: Move }[] = [];
  for (let index = 0; index < history.length; index += 2) {
    movePairs.push({
      number: Math.floor(index / 2) + 1,
      white: history[index],
      black: history[index + 1],
    });
  }

  function refresh() {
    setRevision((value) => value + 1);
  }

  function commitMove(from: Square, to: Square, promotionPiece?: PieceSymbol) {
    try {
      game.move({ from, to, ...(promotionPiece ? { promotion: promotionPiece } : {}) });
      setSelected(null);
      setPromotion(null);
      refresh();
      return true;
    } catch {
      return false;
    }
  }

  function tryMove(from: Square, to: Square) {
    const candidates = game.moves({ square: from, verbose: true }).filter((move) => move.to === to);
    if (!candidates.length) return false;

    if (candidates.some((move) => move.promotion)) {
      const movingPiece = game.get(from);
      if (!movingPiece) return false;
      setPromotion({ from, to, color: movingPiece.color });
      return true;
    }

    return commitMove(from, to);
  }

  function handleSquareClick(square: Square) {
    if (promotion || gameOver) return;

    if (selected) {
      if (selected === square) {
        setSelected(null);
        return;
      }

      if (tryMove(selected, square)) return;

      const targetPiece = game.get(square);
      if (targetPiece?.color === game.turn()) {
        setSelected(square);
      } else {
        setSelected(null);
      }
      return;
    }

    const piece = game.get(square);
    if (piece?.color === game.turn()) setSelected(square);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>, square: Square) {
    if (event.button !== 0 || promotion || gameOver) return;
    const piece = game.get(square);
    if (!piece || piece.color !== game.turn()) return;

    dragRef.current = { from: square, pointerId: event.pointerId };
    setDrag({ from: square, x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    setDrag((current) => current ? { ...current, x: event.clientX, y: event.clientY } : null);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const activeDrag = dragRef.current;
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;

    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-square]");
    const destination = target?.dataset.square as Square | undefined;

    if (destination && destination !== activeDrag.from) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
      tryMove(activeDrag.from, destination);
    }

    dragRef.current = null;
    setDrag(null);
  }

  function handlePointerCancel() {
    dragRef.current = null;
    setDrag(null);
  }

  function undoMove() {
    if (game.undo()) {
      setSelected(null);
      setPromotion(null);
      refresh();
    }
  }

  function newGame() {
    gameRef.current = new Chess();
    setSelected(null);
    setPromotion(null);
    setDrag(null);
    setCopyState("idle");
    refresh();
  }

  function flipBoard() {
    setOrientation((current) => current === "w" ? "b" : "w");
  }

  async function copyFen() {
    try {
      await navigator.clipboard.writeText(game.fen());
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
    window.setTimeout(() => setCopyState("idle"), 1800);
  }

  const topColor: Color = orientation === "w" ? "b" : "w";
  const bottomColor: Color = orientation === "w" ? "w" : "b";
  const ranks = orientation === "w" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = orientation === "w" ? ["a", "b", "c", "d", "e", "f", "g", "h"] : ["h", "g", "f", "e", "d", "c", "b", "a"];

  function renderPlayer(color: Color, location: "top" | "bottom") {
    const isActive = game.turn() === color && !gameOver;
    return (
      <div className={"player-row " + (isActive ? "player-active" : "")}>
        <div className={"player-avatar " + (color === "w" ? "avatar-white" : "avatar-black")}>
          <span>{color === "w" ? "W" : "B"}</span>
        </div>
        <div className="player-copy">
          <span className="player-name">{color === "w" ? "You" : "Opponent"}</span>
          <span className="player-caption">{sideName(color)} pieces</span>
        </div>
        <span className="player-turn">{isActive ? "TO MOVE" : location === "top" ? " " : ""}</span>
      </div>
    );
  }

  return (
    <section className="game-layout" aria-label="Chess game">
      <div className="board-panel">
        {renderPlayer(topColor, "top")}
        <div className="board-frame">
          <div className="board-grid" role="group" aria-label="Chessboard">
            {ranks.map((rank, rowIndex) =>
              files.map((file, columnIndex) => {
                const square = (file + rank) as Square;
                const piece = game.get(square);
                const isLight = (files.indexOf(file) + rank) % 2 === 0;
                const isLastMove = lastMove?.from === square || lastMove?.to === square;
                const isLegal = legalTargets.has(square);
                const isCapture = captureTargets.has(square);
                const isCheckedKing = checkSquare === square;
                const isDragged = drag?.from === square;
                const pieceLabel = piece
                  ? sideName(piece.color) + " " + pieceName(piece.type)
                  : "empty";
                const label = square + ", " + pieceLabel;

                return (
                  <button
                    key={square}
                    type="button"
                    data-square={square}
                    className={[
                      "board-square",
                      isLight ? "square-light" : "square-dark",
                      isLastMove ? "square-last-move" : "",
                      selected === square ? "square-selected" : "",
                      isCheckedKing ? "square-check" : "",
                    ].filter(Boolean).join(" ")}
                    aria-label={label}
                    aria-pressed={selected === square}
                    onClick={() => {
                      if (suppressClickRef.current) {
                        suppressClickRef.current = false;
                        return;
                      }
                      handleSquareClick(square);
                    }}
                    onPointerDown={(event) => handlePointerDown(event, square)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                    onContextMenu={(event) => event.preventDefault()}
                  >
                    {columnIndex === 0 && <span className="rank-coordinate">{rank}</span>}
                    {rowIndex === 7 && <span className="file-coordinate">{file}</span>}
                    {piece && !isDragged && <ChessPiece type={piece.type} color={piece.color} />}
                    {isLegal && (
                      <span className={isCapture ? "move-indicator move-capture" : "move-indicator"} />
                    )}
                  </button>
                );
              }),
            )}
          </div>
          {drag && (() => {
            const draggedPiece = game.get(drag.from);
            return draggedPiece ? (
              <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
                <ChessPiece type={draggedPiece.type} color={draggedPiece.color} />
              </div>
            ) : null;
          })()}
        </div>
        {renderPlayer(bottomColor, "bottom")}
        <div className="board-note">
          <span className="keyboard-hint"><kbd>Click</kbd> or drag a piece to move</span>
          <span className="board-coordinates">FILES A–H <span /> RANKS 1–8</span>
        </div>
      </div>

      <aside className="game-sidebar">
        <div className="status-card">
          <div className="sidebar-section-label">GAME STATUS</div>
          <div className="status-main">
            <span className={"turn-indicator " + (gameOver ? "turn-finished" : game.turn() === "w" ? "turn-white" : "turn-black")} />
            <div>
              <h2>{statusTitle}</h2>
              <p>{statusDetail}</p>
            </div>
          </div>
          {game.isCheck() && !gameOver && <div className="check-callout">Check. Find a safe square for your king.</div>}
          {gameOver && <div className="result-callout">This game has finished. Start a new game to play again.</div>}
        </div>

        <div className="controls-card">
          <div className="sidebar-section-label">CONTROLS</div>
          <button className="primary-button" type="button" onClick={newGame}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v14M3 10h14" /></svg>
            New game
          </button>
          <div className="secondary-actions">
            <button className="secondary-button" type="button" onClick={undoMove} disabled={history.length === 0}>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 6 3 10l4 4M3.5 10H11a5 5 0 0 1 0 10" /></svg>
              Undo
            </button>
            <button className="secondary-button" type="button" onClick={flipBoard}>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h12M12 3l4 3-4 3M16 14H4m4-3-4 3 4 3" /></svg>
              Flip board
            </button>
          </div>
          <button className="text-button" type="button" onClick={copyFen}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /></svg>
            {copyState === "copied" ? "FEN copied" : copyState === "error" ? "Could not copy FEN" : "Copy position (FEN)"}
          </button>
        </div>

        <div className="moves-card">
          <div className="moves-heading">
            <div className="sidebar-section-label">MOVE HISTORY</div>
            <span className="move-count">{history.length} {history.length === 1 ? "move" : "moves"}</span>
          </div>
          {movePairs.length === 0 ? (
            <div className="empty-history">
              <span className="empty-history-icon">· · ·</span>
              <p>Your game starts here.</p>
              <span>Make a move to begin the notation.</span>
            </div>
          ) : (
            <div className="move-list" aria-label="Move history">
              {movePairs.map((pair) => (
                <div className="move-row" key={pair.number}>
                  <span className="move-number">{pair.number}.</span>
                  <span className={"move-san " + (pair.white === lastMove ? "move-current" : "")}>
                    {pair.white?.san ?? ""}
                  </span>
                  <span className={"move-san " + (pair.black === lastMove ? "move-current" : "")}>
                    {pair.black?.san ?? ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sidebar-footnote">
          <span className="footnote-mark">i</span>
          <p>ChessBox uses chess.js to validate every move. No move is accepted unless it follows the rules of chess.</p>
        </div>
      </aside>

      {promotion && (
        <div className="promotion-backdrop" role="presentation" onClick={() => setPromotion(null)}>
          <div
            className="promotion-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="promotion-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sidebar-section-label">PAWN PROMOTION</div>
            <h2 id="promotion-title">Choose a piece</h2>
            <p>Your pawn reached the final rank.</p>
            <div className="promotion-options">
              {promotionOptions.map((option) => (
                <button
                  className="promotion-option"
                  key={option.value}
                  type="button"
                  onClick={() => commitMove(promotion.from, promotion.to, option.value)}
                  aria-label={"Promote to " + option.label}
                >
                  <ChessPiece type={option.value} color={promotion.color} />
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
            <button className="text-button promotion-cancel" type="button" onClick={() => setPromotion(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
