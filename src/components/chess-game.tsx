"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chess, type Color, type Move, type PieceSymbol, type Square } from "chess.js";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ChessPiece } from "@/components/chess-piece";

type Screen = "play" | "puzzles" | "analysis" | "learn";
type Task = "move" | "analysis" | null;
type Analysis = { depth: number; evaluation: string; line: string[] };
type Promotion = { from: Square; to: Square; color: Color };
type Drag = { from: Square; x: number; y: number };

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const ENGINE_URL = BASE_PATH + "/engine/stockfish-19-lite-single.js";
const PUZZLES = [
  {
    title: "The exposed king",
    theme: "Checkmate in one",
    side: "White",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 3 4",
    solution: "h5f7",
    explanation: "The queen is protected by the bishop on c4. Together they control the black king's escape squares.",
  },
  {
    title: "A fragile diagonal",
    theme: "Checkmate in one",
    side: "Black",
    fen: "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2",
    solution: "d8h4",
    explanation: "The queen uses the open diagonal to reach h4. White's f-pawn has moved, leaving the king exposed.",
  },
];
const PROMOTION_OPTIONS: { type: PieceSymbol; label: string }[] = [\n  { type: "q", label: "Queen" },\n  { type: "r", label: "Rook" },\n  { type: "b", label: "Bishop" },\n  { type: "n", label: "Knight" },\n];\nconst OPENINGS = [
  { name:"Italian Game", eco:"C50–C54", style:"Open game · quick development", moves:"1. e4 e5 2. Nf3 Nc6 3. Bc4", pgn:"1. e4 e5 2. Nf3 Nc6 3. Bc4", note:"Develop the bishop actively and put pressure on f7. A natural opening that teaches development and central control." },
  { name:"Ruy Lopez", eco:"C60–C99", style:"Open game · long-term pressure", moves:"1. e4 e5 2. Nf3 Nc6 3. Bb5", pgn:"1. e4 e5 2. Nf3 Nc6 3. Bb5", note:"The bishop pressures the knight that supports e5. The position often becomes a strategic battle over the centre." },
  { name:"Queen's Gambit", eco:"D06–D69", style:"Closed game · central tension", moves:"1. d4 d5 2. c4", pgn:"1. d4 d5 2. c4", note:"White offers the c-pawn to challenge Black's central pawn on d5. It is a strategic idea, not a simple pawn sacrifice." },
  { name:"London System", eco:"D02–D05", style:"System opening · solid structure", moves:"1. d4 d5 2. Bf4", pgn:"1. d4 d5 2. Bf4", note:"White develops the light-squared bishop outside the pawn chain and builds a dependable setup." },
];

function sideName(color: Color) { return color === "w" ? "White" : "Black"; }
function pieceName(type: PieceSymbol) {
  const names: Record<PieceSymbol, string> = { p:"pawn", n:"knight", b:"bishop", r:"rook", q:"queen", k:"king" };
  return names[type];
}
function parseUci(value: string) {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(value)) return null;
  return { from:value.slice(0,2) as Square, to:value.slice(2,4) as Square, promotion:value[4] as PieceSymbol | undefined };
}

export function ChessPlatform() {
  const gameRef = useRef(new Chess());
  const workerRef = useRef<Worker | null>(null);
  const taskRef = useRef<Task>(null);
  const requestedFenRef = useRef("");
  const analysisFenRef = useRef("");
  const suppressClickRef = useRef(false);
  const dragRef = useRef<{ from: Square; pointerId: number } | null>(null);

  const [revision, setRevision] = useState(0);
  const [screen, setScreen] = useState<Screen>("play");
  const [mode, setMode] = useState<"computer" | "local">("computer");
  const [humanColor, setHumanColor] = useState<Color>("w");
  const [skill, setSkill] = useState(8);
  const [orientation, setOrientation] = useState<"w" | "b">("w");
  const [selected, setSelected] = useState<Square | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState("");
  const [engineThinking, setEngineThinking] = useState(false);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [fenInput, setFenInput] = useState("");
  const [pgnInput, setPgnInput] = useState("");
  const [dataMessage, setDataMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [puzzleSolved, setPuzzleSolved] = useState(false);
  const [puzzleMessage, setPuzzleMessage] = useState("Find the best move.");

  const game = gameRef.current;
  const history = game.history({ verbose: true });
  const lastMove = history.length ? history[history.length - 1] : null;
  const gameOver = game.isGameOver();
  const legalMoves = selected ? game.moves({ square:selected, verbose:true }) as Move[] : [];
  const legalTargets = new Set(legalMoves.map((move) => move.to));
  const captureTargets = new Set(legalMoves.filter((move) => move.captured || move.isEnPassant()).map((move) => move.to));
  const checkedKing = game.isCheck() ? game.findPiece({ type:"k", color:game.turn() })[0] as Square | undefined : undefined;
  const currentPuzzle = PUZZLES[puzzleIndex];
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (typeof Worker === "undefined") {
      setEngineError("This browser does not support Web Workers.");
      return;
    }
    let worker: Worker;
    try {
      worker = new Worker(ENGINE_URL, { name:"ChessBox Stockfish" });
    } catch {
      setEngineError("The chess engine could not be started.");
      return;
    }
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<string>) => {
      const line = typeof event.data === "string" ? event.data : String(event.data);
      if (line.includes("uciok")) { worker.postMessage("isready"); return; }
      if (line.includes("readyok")) { setEngineReady(true); setEngineError(""); return; }

      if (taskRef.current === "analysis" && line.startsWith("info ")) {
        const depth = Number(line.match(/\bdepth (\d+)/)?.[1] ?? 0);
        const score = line.match(/\bscore (cp|mate) (-?\d+)/);
        const pv = line.match(/\bpv (.+)$/)?.[1];
        if (score && depth) {
          const value = Number(score[2]);
          const evaluation = score[1] === "mate" ? "Mate in " + value : (value > 0 ? "+" : "") + (value / 100).toFixed(2);
          let sanLine: string[] = [];
          if (pv && analysisFenRef.current) {
            try {
              const preview = new Chess(analysisFenRef.current);
              sanLine = pv.split(/\s+/).slice(0,8).map((text) => {
                const move = parseUci(text);
                if (!move) throw new Error("Invalid engine variation");
                return preview.move(move).san;
              });
            } catch { sanLine = []; }
          }
          setAnalysis({ depth, evaluation, line:sanLine });
        }
      }
      if (line.startsWith("bestmove ")) {
        const currentTask = taskRef.current;
        taskRef.current = null;
        if (currentTask === "move") {
          const best = line.split(/\s+/)[1];
          if (best && best !== "(none)" && gameRef.current.fen() === requestedFenRef.current) {
            const parsed = parseUci(best);
            if (parsed) {
              try { gameRef.current.move(parsed); refresh(); }
              catch { setEngineError("The engine returned a move that could not be applied."); }
            }
          }
          setEngineThinking(false);
        } else if (currentTask === "analysis") setAnalysisBusy(false);
      }
    };
    worker.onerror = () => {
      setEngineReady(false);
      setEngineThinking(false);
      setAnalysisBusy(false);
      setEngineError("Stockfish could not load. Check that deployment finished, then refresh.");
    };
    worker.postMessage("uci");
    return () => { worker.terminate(); workerRef.current = null; taskRef.current = null; };
  }, [refresh]);

  useEffect(() => {
    if (screen !== "play" || mode !== "computer" || game.turn() === humanColor ||
        game.isGameOver() || !engineReady || !workerRef.current || taskRef.current) return;
    const fen = game.fen();
    requestedFenRef.current = fen;
    taskRef.current = "move";
    setEngineThinking(true);
    workerRef.current.postMessage("setoption name Skill Level value " + skill);
    workerRef.current.postMessage("position fen " + fen);
    workerRef.current.postMessage("go movetime 850");
  }, [screen, mode, humanColor, skill, engineReady, revision]);

  const statusTitle = game.isCheckmate() ? sideName(game.turn() === "w" ? "b" : "w") + " wins" : game.isDraw() ? "Draw" : sideName(game.turn()) + " to move";
  const statusDetail = game.isCheckmate() ? "Checkmate" : game.isStalemate() ? "Stalemate" :
    game.isThreefoldRepetition() ? "Threefold repetition" : game.isInsufficientMaterial() ? "Insufficient material" :
    game.isDraw() ? "Draw by the fifty-move rule" : game.isCheck() ? "King in check" : "Game in progress";

  const moveRows: { number:number; white?:Move; black?:Move }[] = [];
  for (let i=0; i<history.length; i+=2) moveRows.push({ number:Math.floor(i/2)+1, white:history[i], black:history[i+1] });

  function isHumanTurn() { return mode === "local" || game.turn() === humanColor; }
  function stopEngineTask() {
    if (workerRef.current && taskRef.current) workerRef.current.postMessage("stop");
    taskRef.current = null;
    setEngineThinking(false);
    setAnalysisBusy(false);
  }
  function clearSelection() { dragRef.current=null; setDrag(null); setSelected(null); }

  function commitMove(from: Square, to: Square, promotionPiece?: PieceSymbol) {
    if (gameOver || promotion || (screen === "play" && !isHumanTurn())) return false;
    if (screen === "puzzles") {
      if (puzzleSolved) return false;
      if (from + to + (promotionPiece ?? "") !== currentPuzzle.solution) {
        setPuzzleMessage("Not quite. Look for the forcing move and try again.");
        setSelected(null);
        return false;
      }
    }
    try {
      game.move({ from, to, ...(promotionPiece ? { promotion:promotionPiece } : {}) });
      setSelected(null); setPromotion(null); setAnalysis(null);
      if (screen === "puzzles") { setPuzzleSolved(true); setPuzzleMessage("Puzzle solved. Great find!"); }
      refresh();
      return true;
    } catch { return false; }
  }

  function tryMove(from: Square, to: Square) {
    const candidates = game.moves({ square:from, verbose:true }).filter((move) => move.to === to);
    if (!candidates.length) return false;
    if (candidates.some((move) => move.promotion)) {
      const piece = game.get(from);
      if (!piece) return false;
      setPromotion({ from, to, color:piece.color });
      return true;
    }
    return commitMove(from,to);
  }

  function handleSquareClick(square: Square) {
    if (gameOver || promotion || (screen === "play" && !isHumanTurn())) return;
    if (selected) {
      if (selected === square) { setSelected(null); return; }
      if (tryMove(selected,square)) return;
      const piece = game.get(square);
      setSelected(piece?.color === game.turn() ? square : null);
      return;
    }
    const piece = game.get(square);
    if (piece?.color === game.turn()) setSelected(square);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>, square: Square) {
    if (event.button !== 0 || gameOver || promotion || (screen === "play" && !isHumanTurn())) return;
    const piece = game.get(square);
    if (!piece || piece.color !== game.turn()) return;
    dragRef.current = { from:square, pointerId:event.pointerId };
    setDrag({ from:square, x:event.clientX, y:event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    setDrag((current) => current ? { ...current, x:event.clientX, y:event.clientY } : null);
  }
  function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const active = dragRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const target = document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>("[data-square]");
    const destination = target?.dataset.square as Square | undefined;
    if (destination && destination !== active.from) {
      suppressClickRef.current = true;
      window.setTimeout(() => { suppressClickRef.current=false; },0);
      tryMove(active.from,destination);
    }
    dragRef.current=null; setDrag(null);
  }

  function startNewGame() {
    stopEngineTask();
    gameRef.current = new Chess();
    setScreen("play"); setSelected(null); setPromotion(null); setPuzzleSolved(false); setAnalysis(null); setCopyMessage("");
    refresh();
  }
  function undoMove() {
    stopEngineTask();
    if (mode === "computer" && game.turn() === humanColor && history.length >= 2) { game.undo(); game.undo(); }
    else game.undo();
    clearSelection(); setAnalysis(null); refresh();
  }
  function loadPuzzle(index: number) {
    const safeIndex = (index + PUZZLES.length) % PUZZLES.length;
    const puzzle = PUZZLES[safeIndex];
    stopEngineTask();
    gameRef.current = new Chess(puzzle.fen);
    setPuzzleIndex(safeIndex); setPuzzleSolved(false);
    setPuzzleMessage("Find the best move. " + puzzle.theme + ".");
    setOrientation(puzzle.fen.split(" ")[1] === "b" ? "b" : "w");
    setSelected(null); setPromotion(null); setAnalysis(null); refresh();
  }
  function openScreen(next: Screen) {
    stopEngineTask(); clearSelection(); setScreen(next);
    if (next === "puzzles") loadPuzzle(puzzleIndex);
    if (next === "play" && gameRef.current.isGameOver()) startNewGame();
  }
  function loadOpening(pgn: string) {
    try {
      const openingGame = new Chess();
      openingGame.loadPgn(pgn);
      stopEngineTask(); gameRef.current=openingGame;
      setScreen("play"); setMode("local"); setOrientation("w"); clearSelection(); setAnalysis(null); refresh();
    } catch { setDataMessage("That opening line could not be loaded."); }
  }
  function runAnalysis() {
    if (!engineReady || !workerRef.current || taskRef.current || game.isGameOver()) return;
    const fen = game.fen();
    analysisFenRef.current=fen; taskRef.current="analysis";
    setAnalysis(null); setAnalysisBusy(true);
    workerRef.current.postMessage("position fen " + fen);
    workerRef.current.postMessage("go depth 15");
  }
  async function copyText(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setCopyMessage(label + " copied"); }
    catch { setCopyMessage("Clipboard unavailable in this browser"); }
    window.setTimeout(() => setCopyMessage(""),1800);
  }
  function loadFen() {
    try {
      const next = new Chess(fenInput.trim());
      stopEngineTask(); gameRef.current=next; setScreen("analysis"); setMode("local");
      clearSelection(); setAnalysis(null); setDataMessage("Position loaded successfully."); refresh();
    } catch { setDataMessage("That FEN is invalid. Check the position and try again."); }
  }
  function loadPgn() {
    try {
      const next = new Chess(); next.loadPgn(pgnInput.trim());
      stopEngineTask(); gameRef.current=next; setScreen("analysis"); setMode("local");
      clearSelection(); setAnalysis(null); setDataMessage("PGN loaded successfully."); refresh();
    } catch { setDataMessage("That PGN could not be read. Check its move notation."); }
  }

  const ranks = orientation === "w" ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
  const files = orientation === "w" ? ["a","b","c","d","e","f","g","h"] : ["h","g","f","e","d","c","b","a"];
  const navItems: { id:Screen; label:string }[] = [
    {id:"play",label:"Play"},{id:"puzzles",label:"Puzzles"},{id:"analysis",label:"Analysis"},{id:"learn",label:"Learn"}
  ];

  function renderPlayer(color: Color, place: "top" | "bottom") {
    const active = game.turn() === color && !gameOver;
    const name = screen === "play" && mode === "computer" ? color === humanColor ? "You" : "Stockfish" : sideName(color);
    return (
      <div className={"player-row " + (active ? "player-active" : "")}>
        <div className={"player-avatar " + (color === "w" ? "avatar-white" : "avatar-black")}><span>{color === "w" ? "W" : "B"}</span></div>
        <div className="player-copy"><span className="player-name">{name}</span><span className="player-caption">{sideName(color)} pieces</span></div>
        <span className="player-turn">{active ? "TO MOVE" : place === "top" ? "" : ""}</span>
      </div>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href={BASE_PATH + "/"} aria-label="ChessBox home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none"><rect x="2" y="2" width="28" height="28" rx="7" fill="currentColor"/><path d="M8 8h7v7H8zM17 17h7v7h-7z" fill="#20272C"/><path d="M17 8h7v7h-7zM8 17h7v7H8z" fill="#E9EDE8"/></svg>
          </span>
          <span className="brand-name">chessbox</span>
        </a>
        <nav className="topbar-nav" aria-label="Main navigation">
          {navItems.map((item) => <button className={"nav-tab " + (screen === item.id ? "nav-tab-active" : "")} key={item.id} type="button" onClick={() => openScreen(item.id)}>{item.label}</button>)}
        </nav>
        <a className="github-link" href="https://github.com/ajxiye/chessbox" target="_blank" rel="noreferrer">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.56.1.76-.24.76-.54v-2.1c-3.1.68-3.75-1.32-3.75-1.32-.5-1.3-1.24-1.65-1.24-1.65-1.01-.7.08-.69.08-.69 1.12.08 1.7 1.15 1.7 1.15.99 1.7 2.6 1.21 3.23.93.1-.72.39-1.21.7-1.49-.28-2.48-1.24-5.08-5.52-5.08-1.22 0-2.22.44-3.01 1.15-.28-.12-1.42-.5-2.96.11 0 0-.3.94 1.14 3.05a10.6 10.6 0 0 1 0 5.56c-1.44 2.12-1.14 3.05-1.14 3.05.61 1.54 2.68.23 2.96.12.78.72 1.78 1.15 3.01 1.15 4.29 0 5.23-2.61 5.5-5.1.35.4 1.02.75 2.06.75h3.12c.3 0 .65.2.54.77A11.1 11.1 0 0 0 12 .9Z"/></svg>
          <span>Source</span><span className="external-arrow">↗</span>
        </a>
      </header>

      <div className="page-content">
        <section className="page-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-line"/> CHESSBOX / {screen.toUpperCase()}</div>
            <h1>{screen === "play" ? "A board of your own." : screen === "puzzles" ? "Find the move." : screen === "analysis" ? "Look a little deeper." : "Learn the game."}</h1>
            <p>{screen === "play" ? "Play a friend locally or take on Stockfish, right in your browser." : screen === "puzzles" ? "A tactical challenge. No account, rating, or paywall." : screen === "analysis" ? "Explore positions with a free, local chess engine." : "Study a few classic openings and build a feel for the position."}</p>
          </div>
          <div className="build-label"><span className="status-dot"/> FREE · OPEN SOURCE</div>
        </section>

        {screen === "learn" ? (
          <section className="learning-grid">
            {OPENINGS.map((opening) => (
              <article className="opening-card" key={opening.name}>
                <div className="opening-meta"><span>{opening.eco}</span><span>{opening.style}</span></div>
                <h2>{opening.name}</h2><div className="opening-line">{opening.moves}</div>
                <p>{opening.note}</p>
                <button className="primary-button" type="button" onClick={() => loadOpening(opening.pgn)}>Load position on board <span aria-hidden="true">↗</span></button>
              </article>
            ))}
            <div className="learning-note"><span className="footnote-mark">i</span><p>These are starting points, not complete opening repertoires. Load a line to continue playing from its final position.</p></div>
          </section>
        ) : (
          <section className="game-layout">
            <div className="board-panel">
              {renderPlayer(orientation === "w" ? "b" : "w","top")}
              <div className="board-frame">
                <div className="board-grid" role="group" aria-label="Chessboard">
                  {ranks.map((rank,rowIndex) => files.map((file,columnIndex) => {
                    const square = (file + rank) as Square;
                    const piece = game.get(square);
                    const light = (file.charCodeAt(0)-97+rank)%2 === 0;
                    const last = lastMove?.from === square || lastMove?.to === square;
                    const legal = legalTargets.has(square);
                    const capture = captureTargets.has(square);
                    const checked = checkedKing === square;
                    const isDragged = drag?.from === square;
                    const locked = screen === "play" && mode === "computer" && !isHumanTurn();
                    return (
                      <button key={square} type="button" data-square={square}
                        className={["board-square",light?"square-light":"square-dark",last?"square-last-move":"",selected===square?"square-selected":"",checked?"square-check":""].filter(Boolean).join(" ")}
                        aria-label={square + ", " + (piece ? sideName(piece.color)+" "+pieceName(piece.type) : "empty")}
                        aria-pressed={selected===square}
                        disabled={locked || (screen==="puzzles" && puzzleSolved)}
                        onClick={() => { if(suppressClickRef.current){suppressClickRef.current=false;return;} handleSquareClick(square); }}
                        onPointerDown={(event)=>handlePointerDown(event,square)}
                        onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
                        onPointerCancel={clearSelection} onContextMenu={(event)=>event.preventDefault()}>
                        {columnIndex===0 && <span className="rank-coordinate">{rank}</span>}
                        {rowIndex===7 && <span className="file-coordinate">{file}</span>}
                        {piece && !isDragged && <ChessPiece type={piece.type} color={piece.color}/>}
                        {legal && <span className={capture?"move-indicator move-capture":"move-indicator"}/>}
                      </button>
                    );
                  }))}
                </div>
                {drag && (() => { const piece=game.get(drag.from); return piece ? <div className="drag-ghost" style={{left:drag.x,top:drag.y}}><ChessPiece type={piece.type} color={piece.color}/></div> : null; })()}
              </div>
              {renderPlayer(orientation === "w" ? "w" : "b","bottom")}
              <div className="board-note"><span className="keyboard-hint"><kbd>Click</kbd> or drag a piece to move</span><span className="board-coordinates">FILES A–H <span/> RANKS 1–8</span></div>
            </div>

            <aside className="game-sidebar">
              {screen==="play" && <>
                <div className="status-card">
                  <div className="sidebar-section-label">GAME STATUS</div>
                  <div className="status-main"><span className={"turn-indicator "+(gameOver?"turn-finished":game.turn()==="w"?"turn-white":"turn-black")}/><div><h2>{statusTitle}</h2><p>{engineThinking?"Stockfish is thinking…":statusDetail}</p></div></div>
                  {game.isCheck() && !gameOver && <div className="check-callout">Check. Find a safe square for your king.</div>}
                  {gameOver && <div className="result-callout">Game finished. Start a new game to play again.</div>}
                </div>
                <div className="controls-card">
                  <div className="sidebar-section-label">GAME MODE</div>
                  <div className="mode-switch">
                    <button type="button" className={mode==="computer"?"mode-option mode-active":"mode-option"} onClick={()=>{setMode("computer");setAnalysis(null);}}>vs Computer</button>
                    <button type="button" className={mode==="local"?"mode-option mode-active":"mode-option"} onClick={()=>{setMode("local");stopEngineTask();}}>Local 2-player</button>
                  </div>
                  {mode==="computer" && <>
                    <label className="field-label" htmlFor="player-side">Play as</label>
                    <select id="player-side" className="field-select" value={humanColor} onChange={(event)=>{setHumanColor(event.target.value as Color);setOrientation(event.target.value as Color);}}>
                      <option value="w">White</option><option value="b">Black</option>
                    </select>
                    <label className="field-label" htmlFor="engine-skill">Engine strength <span>{skill}/20</span></label>
                    <input id="engine-skill" className="skill-slider" type="range" min="0" max="20" value={skill} onChange={(event)=>setSkill(Number(event.target.value))}/>
                  </>}
                  <button className="primary-button" type="button" onClick={startNewGame}>＋ New game</button>
                  <div className="secondary-actions">
                    <button className="secondary-button" type="button" onClick={undoMove} disabled={history.length===0}>↶ Undo</button>
                    <button className="secondary-button" type="button" onClick={()=>setOrientation(value=>value==="w"?"b":"w")}>⇅ Flip board</button>
                  </div>
                  <button className="text-button" type="button" onClick={()=>copyText(game.pgn(),"PGN")}>Copy game (PGN)</button>
                  <button className="text-button" type="button" onClick={()=>copyText(game.fen(),"FEN")}>Copy position (FEN)</button>
                  {copyMessage && <div className="inline-message">{copyMessage}</div>}
                </div>
                <div className="moves-card">
                  <div className="moves-heading"><div className="sidebar-section-label">MOVE HISTORY</div><span className="move-count">{history.length} plies</span></div>
                  {moveRows.length===0 ? <div className="empty-history"><span className="empty-history-icon">· · ·</span><p>Your game starts here.</p><span>Make a move to begin the notation.</span></div> :
                    <div className="move-list" aria-label="Move history">{moveRows.map(row=><div className="move-row" key={row.number}><span className="move-number">{row.number}.</span><span className="move-san">{row.white?.san??""}</span><span className="move-san">{row.black?.san??""}</span></div>)}</div>}
                </div>
                <div className="engine-footnote"><span className={engineReady?"status-dot":"engine-dot-off"}/><p>{engineReady?"Stockfish 19 is ready in your browser.":engineError||"Loading the chess engine…"}</p></div>
              </>}

              {screen==="puzzles" && <>
                <div className="status-card">
                  <div className="sidebar-section-label">TACTIC SET · {puzzleIndex+1}/{PUZZLES.length}</div>
                  <div className="puzzle-title">{currentPuzzle.title}</div>
                  <div className="puzzle-tags"><span>{currentPuzzle.theme}</span><span>{currentPuzzle.side} to move</span></div>
                  <p className="puzzle-prompt">{puzzleMessage}</p>
                  {puzzleSolved && <p className="puzzle-explanation">{currentPuzzle.explanation}</p>}
                </div>
                <div className="controls-card">
                  <button className="primary-button" type="button" onClick={()=>loadPuzzle(puzzleIndex+1)}>Next puzzle <span>→</span></button>
                  <button className="secondary-button" type="button" onClick={()=>loadPuzzle(puzzleIndex)}>Restart puzzle</button>
                  <button className="text-button" type="button" onClick={()=>openScreen("play")}>Back to playing</button>
                </div>
                <div className="sidebar-footnote"><span className="footnote-mark">i</span><p>Original ChessBox exercises. More puzzle sets and difficulty levels can be added as open data.</p></div>
              </>}

              {screen==="analysis" && <>
                <div className="status-card">
                  <div className="sidebar-section-label">ENGINE ANALYSIS</div>
                  <div className="status-main"><span className="turn-indicator turn-finished"/><div><h2>{analysis?analysis.evaluation:analysisBusy?"Analysing…":"Ready to analyse"}</h2><p>{analysis?"Depth "+analysis.depth:"Stockfish 19 · browser engine"}</p></div></div>
                  {analysis?.line.length ? <div className="pv-line"><span>BEST LINE</span><p>{analysis.line.join("  ")}</p></div>:null}
                  <button className="primary-button analysis-button" type="button" onClick={runAnalysis} disabled={!engineReady||analysisBusy||engineThinking||gameOver}>{analysisBusy?"Analysing position…":"Analyse current position"}</button>
                  {engineError && <p className="form-message">{engineError}</p>}
                </div>
                <div className="controls-card">
                  <div className="sidebar-section-label">LOAD POSITION</div>
                  <label className="field-label" htmlFor="fen-input">FEN</label>
                  <textarea id="fen-input" className="data-input" rows={3} value={fenInput} onChange={event=>setFenInput(event.target.value)} placeholder="Paste a FEN position…"/>
                  <button className="secondary-button" type="button" onClick={loadFen}>Load FEN</button>
                  <label className="field-label" htmlFor="pgn-input">PGN</label>
                  <textarea id="pgn-input" className="data-input" rows={4} value={pgnInput} onChange={event=>setPgnInput(event.target.value)} placeholder="Paste a PGN game…"/>
                  <button className="secondary-button" type="button" onClick={loadPgn}>Load PGN</button>
                  <button className="text-button" type="button" onClick={()=>copyText(game.pgn(),"PGN")}>Copy current PGN</button>
                  <button className="text-button" type="button" onClick={()=>copyText(game.fen(),"FEN")}>Copy current FEN</button>
                  {dataMessage && <p className="form-message">{dataMessage}</p>}{copyMessage && <p className="form-message">{copyMessage}</p>}
                </div>
              </>}
            </aside>
          </section>
        )}

        <footer className="page-footer"><span>ChessBox <span className="footer-separator">/</span> Open source chess</span><span>No ads. No subscriptions. No account required.</span></footer>
      </div>

      {promotion && <div className="promotion-backdrop" role="presentation" onClick={()=>setPromotion(null)}>
        <div className="promotion-dialog" role="dialog" aria-modal="true" aria-labelledby="promotion-title" onClick={event=>event.stopPropagation()}>
          <div className="sidebar-section-label">PAWN PROMOTION</div><h2 id="promotion-title">Choose a piece</h2><p>Your pawn reached the final rank.</p>
          <div className="promotion-options">{PROMOTION_OPTIONS.map(option=><button className="promotion-option" key={option.type} type="button" onClick={()=>commitMove(promotion.from,promotion.to,option.type)}><ChessPiece type={option.type} color={promotion.color}/><span>{option.label}</span></button>)}</div>
          <button className="text-button promotion-cancel" type="button" onClick={()=>setPromotion(null)}>Cancel</button>
        </div>
      </div>}
    </main>
  );
}
