"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chess, type Color, type Move, type PieceSymbol, type Square } from "chess.js";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ChessPiece } from "@/components/chess-piece";

type Screen = "home" | "play" | "puzzles" | "analysis" | "learn" | "live" | "community" | "more";
type Task = "move" | "analysis" | null;
type Analysis = { depth: number; evaluation: string; line: string[] };
type Promotion = { from: Square; to: Square; color: Color };
type Drag = { from: Square; x: number; y: number };
type RemotePuzzle = { id:string; rating:number; plays:number; themes:string[]; solution:string[]; initialPly:number; gamePgn:string };

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
const PROMOTION_OPTIONS: { type: PieceSymbol; label: string }[] = [
  { type: "q", label: "Queen" },
  { type: "r", label: "Rook" },
  { type: "b", label: "Bishop" },
  { type: "n", label: "Knight" },
];
const OPENINGS = [
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

export function ChessPlatform({ initialScreen = "home" }: { initialScreen?: Screen }) {
  const [game, setGame] = useState(() => new Chess());
  const gameRef = useRef(game);
  const workerRef = useRef<Worker | null>(null);
  const taskRef = useRef<Task>(null);
  const requestedFenRef = useRef("");
  const analysisFenRef = useRef("");
  const suppressClickRef = useRef(false);
  const dragRef = useRef<{ from: Square; pointerId: number } | null>(null);

  const [revision, setRevision] = useState(0);
  const [screen, setScreen] = useState<Screen>(initialScreen);
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
  const [remotePuzzle, setRemotePuzzle] = useState<RemotePuzzle | null>(null);
  const [puzzleTurnIndex, setPuzzleTurnIndex] = useState(1);
  const [puzzleLoading, setPuzzleLoading] = useState(false);
  const [puzzleHintLevel, setPuzzleHintLevel] = useState(0);
  const [puzzleCompletedCount, setPuzzleCompletedCount] = useState(0);
  const [puzzleStreak, setPuzzleStreak] = useState(0);
  const [matchTab, setMatchTab] = useState<"moves" | "chat" | "info">("moves");
  const [searchQuery, setSearchQuery] = useState("");
  const [timeControlSeconds, setTimeControlSeconds] = useState(600);
  const [clockEnabled, setClockEnabled] = useState(false);
  const [clock, setClock] = useState({ w: 600, b: 600 });

  const history = game.history({ verbose: true });
  const lastMove = history.length ? history[history.length - 1] : null;
  const timedOut = clockEnabled && clock[game.turn()] <= 0;
  const gameOver = game.isGameOver() || timedOut;
  const legalMoves = selected ? game.moves({ square:selected, verbose:true }) as Move[] : [];
  const legalTargets = new Set(legalMoves.map((move) => move.to));
  const captureTargets = new Set(legalMoves.filter((move) => move.captured || move.isEnPassant()).map((move) => move.to));
  const checkedKing = game.isCheck() ? game.findPiece({ type:"k", color:game.turn() })[0] as Square | undefined : undefined;
  const currentPuzzle = PUZZLES[puzzleIndex % PUZZLES.length];
  const puzzleRating = remotePuzzle?.rating ?? 1800;
  const puzzleThemes = remotePuzzle?.themes ?? [currentPuzzle.theme];
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => { setScreen(initialScreen); }, [initialScreen]);
  useEffect(() => {
    const onPop = () => {
      const route = window.location.pathname.replace(/\\/+$/, "").split("/").filter(Boolean).pop() ?? "";
      const known: Screen[] = ["play","puzzles","learn","analysis","live","community","more"];
      setScreen(known.includes(route as Screen) ? route as Screen : "home");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (screen !== "play" || !clockEnabled || gameOver) return;
    const timer = window.setInterval(() => {
      setClock((current) => ({ ...current, [game.turn()]: Math.max(0, current[game.turn()] - 1) }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [screen, clockEnabled, game.turn(), gameOver, revision]);

  useEffect(() => {
    if (typeof Worker === "undefined") {
      window.setTimeout(() => setEngineError("This browser does not support Web Workers."), 0);
      return;
    }
    let worker: Worker;
    try {
      worker = new Worker(ENGINE_URL, { name:"ChessBox Stockfish" });
    } catch {
      window.setTimeout(() => setEngineError("The chess engine could not be started."), 0);
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
        gameOver || !engineReady || !workerRef.current || taskRef.current) return;
    const fen = game.fen();
    requestedFenRef.current = fen;
    taskRef.current = "move";
    setEngineThinking(true);
    workerRef.current.postMessage("setoption name Skill Level value " + skill);
    workerRef.current.postMessage("position fen " + fen);
    workerRef.current.postMessage("go movetime 850");
  }, [screen, mode, humanColor, skill, engineReady, revision, game, timedOut]);

  const statusTitle = timedOut ? sideName(game.turn() === "w" ? "b" : "w") + " wins" : game.isCheckmate() ? sideName(game.turn() === "w" ? "b" : "w") + " wins" : game.isDraw() ? "Draw" : sideName(game.turn()) + " to move";
  const statusDetail = timedOut ? "Time expired" : game.isCheckmate() ? "Checkmate" : game.isStalemate() ? "Stalemate" :
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
      const expected = remotePuzzle?.solution[puzzleTurnIndex];
      const expectedMove = expected ? parseUci(expected) : null;
      const correct = remotePuzzle
        ? Boolean(expectedMove && expectedMove.from === from && expectedMove.to === to && (expectedMove.promotion ?? "") === (promotionPiece ?? ""))
        : from + to + (promotionPiece ?? "") === currentPuzzle.solution;
      if (!correct) {
        setPuzzleMessage("Not quite. Look for the forcing move and try again.");
        setSelected(null);
        return false;
      }
    }
    try {
      game.move({ from, to, ...(promotionPiece ? { promotion:promotionPiece } : {}) });
      setSelected(null); setPromotion(null); setAnalysis(null);
      if (screen === "puzzles") {
        if (remotePuzzle) {
          const nextIndex = puzzleTurnIndex + 1;
          if (nextIndex < remotePuzzle.solution.length) {
            const reply = parseUci(remotePuzzle.solution[nextIndex]);
            setPuzzleTurnIndex(nextIndex + 1);
            if (reply) window.setTimeout(() => {
              try {
                const replyGame = gameRef.current;
                replyGame.move({ from:reply.from, to:reply.to, ...(reply.promotion ? {promotion:reply.promotion} : {}) });
                gameRef.current = replyGame; setGame(replyGame); refresh();
              } catch { setPuzzleMessage("The puzzle line could not continue. Load another puzzle."); }
            }, 420);
          } else {
            setPuzzleSolved(true); setPuzzleCompletedCount(v=>v+1); setPuzzleStreak(v=>v+1);
            setPuzzleMessage("Correct! You found the full line.");
          }
        } else {
          setPuzzleSolved(true); setPuzzleCompletedCount(v=>v+1); setPuzzleStreak(v=>v+1);
          setPuzzleMessage("Puzzle solved. Great find!");
        }
      }
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

  function startNewGame(nextMode: "computer" | "local" = mode, seconds = timeControlSeconds) {
    stopEngineTask();
    setMode(nextMode);
    setTimeControlSeconds(seconds);
    setClock({ w: seconds, b: seconds });
    setClockEnabled(seconds > 0);
    const nextGame = new Chess();
    gameRef.current = nextGame;
    setGame(nextGame);
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
    const safeIndex=(index+PUZZLES.length)%PUZZLES.length;
    const puzzle=PUZZLES[safeIndex];
    stopEngineTask();
    const nextGame=new Chess(puzzle.fen);
    gameRef.current=nextGame; setGame(nextGame); setRemotePuzzle(null); setPuzzleTurnIndex(1);
    setPuzzleHintLevel(0); setPuzzleIndex(safeIndex); setPuzzleSolved(false);
    setPuzzleMessage("Find the best move. "+puzzle.theme+".");
    setOrientation(puzzle.fen.split(" ")[1]==="b"?"b":"w");
    setSelected(null); setPromotion(null); setAnalysis(null); refresh();
  }
  async function loadDailyPuzzle() {
    setPuzzleLoading(true); setPuzzleSolved(false); setPuzzleHintLevel(0);
    setPuzzleMessage("Loading today's Lichess puzzle…"); stopEngineTask();
    try {
      const response=await fetch("https://lichess.org/api/puzzle/daily",{headers:{Accept:"application/json"},cache:"no-store"});
      if(!response.ok) throw new Error("Lichess returned "+response.status);
      const payload=await response.json(); const puzzle=payload.puzzle; const pgn=payload.game?.pgn;
      if(!puzzle?.id||!Array.isArray(puzzle.solution)||!puzzle.solution.length||!pgn) throw new Error("Incomplete puzzle response");
      const sourceGame=new Chess(); sourceGame.loadPgn(pgn);
      const history=sourceGame.history({verbose:true});
      const initialPly=Math.max(0,Math.min(Number(puzzle.initialPly??0),history.length));
      const position=new Chess();
      for(const move of history.slice(0,initialPly)) position.move({from:move.from,to:move.to,...(move.promotion?{promotion:move.promotion}:{})});
      const solution=puzzle.solution as string[];
      const first=parseUci(solution[0]); if(!first) throw new Error("Invalid first puzzle move");
      position.move({from:first.from,to:first.to,...(first.promotion?{promotion:first.promotion}:{})});
      gameRef.current=position; setGame(position);
      setRemotePuzzle({id:String(puzzle.id),rating:Number(puzzle.rating??0),plays:Number(puzzle.plays??0),themes:Array.isArray(puzzle.themes)?puzzle.themes:[],solution,initialPly,gamePgn:pgn});
      setPuzzleTurnIndex(1); setPuzzleMessage("Find the best move for "+(position.turn()==="w"?"White":"Black")+".");
      setOrientation(position.turn()); setSelected(null); setPromotion(null); setAnalysis(null); refresh();
    } catch(error) {
      loadPuzzle(puzzleIndex);
      setPuzzleMessage("The Lichess daily puzzle couldn't load. Here's a practice puzzle instead.");
      setDataMessage(error instanceof Error?error.message:"Puzzle service unavailable");
    } finally { setPuzzleLoading(false); }
  }
  function showPuzzleHint() {
    if(!remotePuzzle) {
      setPuzzleHintLevel(v=>Math.min(2,v+1));
      setPuzzleMessage(puzzleHintLevel===0?"Hint: look for a forcing move.":"Hint: look for checks and captures first.");
      return;
    }
    const expected=parseUci(remotePuzzle.solution[puzzleTurnIndex]); if(!expected) return;
    setPuzzleHintLevel(v=>Math.min(2,v+1));
    setPuzzleMessage(puzzleHintLevel===0?"Hint: the move starts from "+expected.from.toUpperCase()+".":"Hint: move from "+expected.from.toUpperCase()+" to "+expected.to.toUpperCase()+".");
  }
  function resetCurrentPuzzle() {
    if(!remotePuzzle) { loadPuzzle(puzzleIndex); return; }
    const source=new Chess(); source.loadPgn(remotePuzzle.gamePgn);
    const history=source.history({verbose:true}); const next=new Chess();
    for(const move of history.slice(0,remotePuzzle.initialPly)) next.move({from:move.from,to:move.to,...(move.promotion?{promotion:move.promotion}:{})});
    const first=parseUci(remotePuzzle.solution[0]);
    if(first) next.move({from:first.from,to:first.to,...(first.promotion?{promotion:first.promotion}:{})});
    gameRef.current=next; setGame(next); setPuzzleTurnIndex(1); setPuzzleSolved(false); setPuzzleHintLevel(0);
    setPuzzleMessage("Find the best move."); setSelected(null); refresh();
  }
  function openScreen(next: Screen) {
    stopEngineTask(); clearSelection(); setScreen(next);
    const slug=next==="home"?"":next;
    const path=BASE_PATH+(slug?"/"+slug+"/":"/");
    if(window.location.pathname!==path) window.history.pushState({chessboxScreen:next},"",path);
    if(next==="puzzles") void loadDailyPuzzle();
    if(next==="play"&&game.isGameOver()) startNewGame(mode,timeControlSeconds);
  }
  function loadOpening(pgn: string) {
    try {
      const openingGame = new Chess();
      openingGame.loadPgn(pgn);
      stopEngineTask(); gameRef.current=openingGame; setGame(openingGame); setClockEnabled(false);
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
      stopEngineTask(); gameRef.current=next; setGame(next); setScreen("analysis"); setMode("local");
      clearSelection(); setAnalysis(null); setDataMessage("Position loaded successfully."); refresh();
    } catch { setDataMessage("That FEN is invalid. Check the position and try again."); }
  }
  function loadPgn() {
    try {
      const next = new Chess(); next.loadPgn(pgnInput.trim());
      stopEngineTask(); gameRef.current=next; setGame(next); setScreen("analysis"); setMode("local");
      clearSelection(); setAnalysis(null); setDataMessage("PGN loaded successfully."); refresh();
    } catch { setDataMessage("That PGN could not be read. Check its move notation."); }
  }

  const ranks = orientation === "w" ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
  const files = orientation === "w" ? ["a","b","c","d","e","f","g","h"] : ["h","g","f","e","d","c","b","a"];
  const navItems: { id:Screen; label:string; icon:string }[] = [
    {id:"home",label:"Home",icon:"⌂"},
    {id:"play",label:"Play",icon:"▶"},
    {id:"puzzles",label:"Puzzles",icon:"✣"},
    {id:"learn",label:"Learn",icon:"◆"},
    {id:"analysis",label:"Analysis",icon:"▥"},
    {id:"live",label:"Live",icon:"◉"},
    {id:"community",label:"Community",icon:"♧"},
    {id:"more",label:"More",icon:"•••"},
  ];

  function formatClock(seconds: number) {
    const safe = Math.max(0, seconds);
    const minutes = Math.floor(safe / 60);
    const remaining = safe % 60;
    return String(minutes) + ":" + String(remaining).padStart(2, "0");
  }

  function renderPlayer(color: Color) {
    const active = game.turn() === color && !gameOver;
    const name = mode === "computer" ? color === humanColor ? "You" : "Stockfish" : sideName(color);
    const rating = mode === "computer" ? color === humanColor ? "Guest player" : "Browser engine" : "Local player";
    return (
      <div className={"match-player " + (active ? "match-player-active" : "")}>
        <div className={"match-avatar " + (color === "w" ? "avatar-white" : "avatar-black")}>
          <span>{color === "w" ? "W" : "B"}</span>
          <i />
        </div>
        <div className="match-player-copy">
          <span className="match-player-name">{name}</span>
          <span className="match-player-caption">{rating} · {sideName(color)}</span>
        </div>
        <div className={"match-clock " + (active ? "match-clock-active" : "") + (clock[color] <= 30 && clockEnabled ? " match-clock-low" : "")}>
          <span className="clock-symbol">◷</span>
          {clockEnabled ? formatClock(clock[color]) : "∞"}
        </div>
      </div>
    );
  }

  return (
    <main className="chessbox-app">
      <aside className="site-sidebar">
        <button className="sidebar-brand" type="button" onClick={() => openScreen("home")}>
          <span className="sidebar-brand-piece"><ChessPiece type="n" color="w" /></span>
          <span>ChessBox</span>
        </button>
        <nav className="sidebar-navigation" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              className={"sidebar-nav-item " + (screen === item.id ? "sidebar-nav-active" : "")}
              key={item.id}
              type="button"
              onClick={() => openScreen(item.id)}
            >
              <span className="sidebar-nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="guest-profile">
            <span className="guest-avatar">G</span>
            <span><b>Guest session</b><small>Playing without an account</small></span>
          </div>
          <a className="sidebar-source-link" href="https://github.com/ajxiye/chessbox" target="_blank" rel="noreferrer">
            <span>↗</span> Open-source project
          </a>
          <div className="sidebar-version">FREE FOREVER · OPEN SOURCE</div>
        </div>
      </aside>

      <div className="app-main">
        <header className="dashboard-topbar">
          <label className="global-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  const query = searchQuery.toLowerCase();
                  if (query.includes("puzz")) openScreen("puzzles");
                  else if (query.includes("anal")) openScreen("analysis");
                  else if (query.includes("learn") || query.includes("opening")) openScreen("learn");
                  else openScreen("play");
                }
              }}
              placeholder="Search players, games, or topics..."
              aria-label="Search ChessBox"
            />
          </label>
          <div className="topbar-actions">
            <span className="topbar-status" title="Guest mode">GUEST</span>
            <button className="notification-button" type="button" onClick={() => setDataMessage("You are playing in guest mode. Notifications are not connected.")} aria-label="Notifications">♧</button>
            <div className="topbar-avatar" aria-label="Guest profile">G</div>
          </div>
        </header>

        {screen === "home" && (
          <div className="dashboard-content">
            <div className="dashboard-primary">
              <section className="hero-banner">
                <div className="hero-copy">
                  <span className="hero-kicker">THE HOME OF FREE CHESS</span>
                  <h1>Play Chess<br />for Free</h1>
                  <p>Challenge the engine, play a friend on the same device, and improve your game.</p>
                  <button className="hero-cta" type="button" onClick={() => startNewGame("computer", timeControlSeconds)}>
                    Play Now <span>›</span>
                  </button>
                </div>
                <div className="hero-knight-art" aria-hidden="true">
                  <div className="hero-knight-shape" />
                  <ChessPiece type="n" color="w" className="hero-knight-piece" />
                </div>
                <div className="hero-diagonal hero-diagonal-one" />
                <div className="hero-diagonal hero-diagonal-two" />
              </section>

              <section className="quick-play-section">
                <div className="section-title-row"><h2>Start a Game</h2><span>CHOOSE YOUR PACE</span></div>
                <div className="quick-play-grid">
                  <button className="quick-play-card" type="button" onClick={() => startNewGame("computer", 180)}>
                    <span className="quick-play-icon">ϟ</span><b>Play Blitz</b><small>3 min · vs computer</small>
                  </button>
                  <button className="quick-play-card" type="button" onClick={() => startNewGame("computer", 600)}>
                    <span className="quick-play-icon">◷</span><b>Play Rapid</b><small>10 min · vs computer</small>
                  </button>
                  <button className="quick-play-card" type="button" onClick={() => startNewGame("computer", 1800)}>
                    <span className="quick-play-icon">◴</span><b>Play Classical</b><small>30 min · vs computer</small>
                  </button>
                  <button className="quick-play-card" type="button" onClick={() => startNewGame("local", 600)}>
                    <span className="quick-play-icon">♟</span><b>Play with a Friend</b><small>Two players · one device</small>
                  </button>
                </div>
              </section>

              <section className="dashboard-puzzle-section">
                <div className="section-title-row"><h2><span className="section-heading-icon">✣</span> Puzzles</h2><button type="button" onClick={() => openScreen("puzzles")}>See all <span>→</span></button></div>
                <div className="daily-puzzle-card">
                  <div className="puzzle-thumbnail" aria-hidden="true">
                    <div className="puzzle-mini-board">
                      {Array.from({length: 16}, (_, index) => (
                        <span key={index} className={(Math.floor(index / 4) + index % 4) % 2 === 0 ? "mini-light" : "mini-dark"}>
                          {({1:"♟",3:"♛",4:"♙",5:"♙",6:"♚",11:"♗",14:"♔"} as Record<number,string>)[index] ?? ""}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="daily-puzzle-copy">
                    <b>Daily Puzzle</b>
                    <p>Solve a tactical position and sharpen your pattern recognition.</p>
                    <button className="puzzle-solve-button" type="button" onClick={() => openScreen("puzzles")}>Solve puzzle <span>→</span></button>
                  </div>
                </div>
              </section>

              <section className="learn-strip">
                <div><span className="learn-strip-icon">◆</span><b>Build your chess knowledge</b><small>Explore opening ideas and practical explanations.</small></div>
                <button type="button" onClick={() => openScreen("learn")}>Explore Learn <span>→</span></button>
              </section>
            </div>

            <aside className="dashboard-rail">
              <section className="dashboard-card stats-card">
                <div className="dashboard-card-heading"><h2><span>▥</span> Your Stats</h2><span className="guest-tag">GUEST</span></div>
                <div className="stats-grid">
                  <div><b>Unrated</b><small>Rapid Rating</small></div>
                  <div><b>Unrated</b><small>Blitz Rating</small></div>
                  <div><b>Local</b><small>Profile</small></div>
                </div>
                <div className="stats-note"><span className="status-dot" /> No accounts or rating claims. Your games run in this browser.</div>
              </section>

              <section className="dashboard-card online-card">
                <div className="dashboard-card-heading"><h2><span className="online-dot" /> Online Players</h2><span className="offline-badge">OFFLINE</span></div>
                <div className="offline-players">
                  <div className="offline-avatar">♟</div>
                  <div><b>Online matchmaking</b><small>Not connected in the static Pages build</small></div>
                </div>
                <p>Real-time games need a multiplayer server. You can play the engine or a friend locally right now.</p>
                <button className="rail-action-button" type="button" onClick={() => startNewGame("local", 600)}>Play locally <span>→</span></button>
              </section>

              <section className="dashboard-card recent-card">
                <div className="dashboard-card-heading"><h2><span>◷</span> Recent Games</h2><span className="guest-tag">THIS SESSION</span></div>
                <div className="recent-empty">
                  <span className="recent-empty-icon">♞</span>
                  <b>No saved games yet</b>
                  <small>Start a game to create your first session.</small>
                </div>
                <button className="rail-action-button" type="button" onClick={() => startNewGame("computer", 600)}>Start a game <span>→</span></button>
              </section>

              <section className="dashboard-card open-card">
                <div className="dashboard-card-heading"><h2>Built in the open</h2><span className="status-dot" /></div>
                <p>ChessBox is free, open source, and has no ads or subscriptions.</p>
                <a href="https://github.com/ajxiye/chessbox" target="_blank" rel="noreferrer">View the source code ↗</a>
              </section>
            </aside>
          </div>
        )}

        {screen === "play" && (
          <div className="match-content">
            <div className="match-stage">
              <div className="match-stage-heading">
                <div><span className="match-breadcrumb">CHESSBOX / PLAY</span><h1>{mode === "computer" ? "Practice match" : "Local match"}</h1></div>
                <span className="match-mode-pill">{mode === "computer" ? "VS STOCKFISH" : "TWO PLAYERS · LOCAL"}</span>
              </div>
              <div className="match-board-wrap">
                {renderPlayer(orientation === "w" ? "b" : "w")}
                <div className="board-frame match-board-frame">
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
                      const locked = mode === "computer" && !isHumanTurn();
                      return (
                        <button key={square} type="button" data-square={square}
                          className={["board-square",light?"square-light":"square-dark",last?"square-last-move":"",selected===square?"square-selected":"",checked?"square-check":""].filter(Boolean).join(" ")}
                          aria-label={square + ", " + (piece ? sideName(piece.color)+" "+pieceName(piece.type) : "empty")}
                          aria-pressed={selected===square}
                          disabled={locked || gameOver}
                          onClick={() => { if(suppressClickRef.current){suppressClickRef.current=false;return;} handleSquareClick(square); }}
                          onPointerDown={(event)=>handlePointerDown(event,square)}
                          onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
                          onPointerCancel={clearSelection} onContextMenu={(event)=>event.preventDefault()}>
                          {columnIndex===0 && <span className="rank-coordinate">{rank}</span>}
                          {rowIndex===7 && <span className="file-coordinate">{file}</span>}
                          {piece && !isDragged && <ChessPiece key={square + piece.color + piece.type} type={piece.type} color={piece.color}/>}
                          {legal && <span className={capture?"move-indicator move-capture":"move-indicator"}/>}
                        </button>
                      );
                    }))}
                  </div>
                  {drag && (() => { const piece=game.get(drag.from); return piece ? <div className="drag-ghost" style={{left:drag.x,top:drag.y}}><ChessPiece key={drag.from + piece.color + piece.type} type={piece.type} color={piece.color}/></div> : null; })()}
                </div>
                {renderPlayer(orientation === "w" ? "w" : "b")}
                <div className="match-board-controls">
                  <button type="button" onClick={undoMove} disabled={history.length===0} aria-label="Undo move" title="Undo move">↶</button>
                  <button type="button" onClick={() => startNewGame(mode, timeControlSeconds)} aria-label="New game" title="New game">↻</button>
                  <button type="button" onClick={() => setOrientation(value => value==="w"?"b":"w")} aria-label="Flip board" title="Flip board">⇅</button>
                  <button type="button" onClick={() => copyText(game.fen(), "FEN")} aria-label="Copy position" title="Copy FEN">⧉</button>
                  <span className="match-control-spacer" />
                  <button type="button" onClick={() => openScreen("analysis")} aria-label="Analyse game" title="Analyse game">⚙</button>
                </div>
                <div className="engine-footnote"><span className={engineReady?"status-dot":"engine-dot-off"}/><p>{engineReady ? "Stockfish 19 ready in your browser" : engineError || "Loading local chess engine…"}</p></div>
              </div>
            </div>

            <aside className="match-sidebar">
              <div className="match-tabs" role="tablist" aria-label="Match panel">
                <button type="button" role="tab" aria-selected={matchTab==="moves"} className={matchTab==="moves"?"match-tab match-tab-active":"match-tab"} onClick={() => setMatchTab("moves")}>Moves</button>
                <button type="button" role="tab" aria-selected={matchTab==="chat"} className={matchTab==="chat"?"match-tab match-tab-active":"match-tab"} onClick={() => setMatchTab("chat")}>Chat</button>
                <button type="button" role="tab" aria-selected={matchTab==="info"} className={matchTab==="info"?"match-tab match-tab-active":"match-tab"} onClick={() => setMatchTab("info")}>Info</button>
              </div>
              {matchTab==="moves" && (
                <div className="match-tab-content moves-tab-content">
                  <div className="match-panel-heading"><b>Move list</b><span>{history.length} plies</span></div>
                  {moveRows.length===0 ? (
                    <div className="match-empty"><span>♙</span><b>Waiting for the first move</b><small>Your notation will appear here.</small></div>
                  ) : (
                    <div className="match-move-list">
                      {moveRows.map(row => <div className="match-move-row" key={row.number}><span>{row.number}.</span><b>{row.white?.san ?? ""}</b><b>{row.black?.san ?? ""}</b></div>)}
                    </div>
                  )}
                  {gameOver && <div className="match-result-note">{statusTitle} · {statusDetail}</div>}
                </div>
              )}
              {matchTab==="chat" && (
                <div className="match-tab-content match-info-content">
                  <div className="match-empty"><span>☷</span><b>Chat is unavailable offline</b><small>Chat will be available when ChessBox has a real online multiplayer service. Local games do not send messages anywhere.</small></div>
                </div>
              )}
              {matchTab==="info" && (
                <div className="match-tab-content match-info-content">
                  <div className="match-panel-heading"><b>Game information</b><span>LOCAL</span></div>
                  <div className="info-pair"><span>Game mode</span><b>{mode === "computer" ? "vs Stockfish" : "Local two-player"}</b></div>
                  <div className="info-pair"><span>Time control</span><b>{Math.floor(timeControlSeconds/60)} min</b></div>
                  <div className="info-pair"><span>Turn</span><b>{sideName(game.turn())}</b></div>
                  <div className="info-pair"><span>Status</span><b>{statusDetail}</b></div>
                  <button className="secondary-button" type="button" onClick={() => copyText(game.fen(), "FEN")}>Copy FEN</button>
                  <button className="secondary-button" type="button" onClick={() => copyText(game.pgn(), "PGN")}>Copy PGN</button>
                  {copyMessage && <small className="form-message">{copyMessage}</small>}
                </div>
              )}
              <div className="match-sidebar-bottom">
                <div className="sidebar-section-label">GAME CONTROLS</div>
                <button className="match-action-button" type="button" onClick={undoMove} disabled={history.length===0}>↶ <span>Undo last turn</span></button>
                <button className="match-action-button" type="button" onClick={() => startNewGame(mode, timeControlSeconds)}>＋ <span>New game</span></button>
                <button className="match-action-button" type="button" onClick={() => openScreen("home")}>⌂ <span>Back to home</span></button>
              </div>
            </aside>
          </div>
        )}

        {(screen === "puzzles" || screen === "analysis") && (
          <div className="study-content">
            <section className="study-heading">
              <div><span className="match-breadcrumb">CHESSBOX / {screen.toUpperCase()}</span><h1>{screen === "puzzles" ? "Find the move." : "Look a little deeper."}</h1></div>
              <button className="study-back-button" type="button" onClick={() => openScreen("home")}>← Home</button>
            </section>
            <div className="study-layout">
              <div className="board-panel study-board-panel">
                {renderPlayer(orientation === "w" ? "b" : "w")}
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
                      return (
                        <button key={square} type="button" data-square={square}
                          className={["board-square",light?"square-light":"square-dark",last?"square-last-move":"",selected===square?"square-selected":"",checked?"square-check":""].filter(Boolean).join(" ")}
                          aria-label={square + ", " + (piece ? sideName(piece.color)+" "+pieceName(piece.type) : "empty")}
                          onClick={() => { if(suppressClickRef.current){suppressClickRef.current=false;return;} handleSquareClick(square); }}
                          onPointerDown={(event)=>handlePointerDown(event,square)} onPointerMove={handlePointerMove}
                          onPointerUp={handlePointerUp} onPointerCancel={clearSelection}>
                          {columnIndex===0 && <span className="rank-coordinate">{rank}</span>}
                          {rowIndex===7 && <span className="file-coordinate">{file}</span>}
                          {piece && <ChessPiece key={square + piece.color + piece.type} type={piece.type} color={piece.color}/>}
                          {legal && <span className={capture?"move-indicator move-capture":"move-indicator"}/>}
                        </button>
                      );
                    }))}
                  </div>
                </div>
                {renderPlayer(orientation === "w" ? "w" : "b")}
              </div>
              <aside className="study-sidebar">
                {screen==="puzzles" ? <>
                  <div className="study-card">
                    <div className="sidebar-section-label">TACTIC SET · {puzzleIndex+1}/{PUZZLES.length}</div>
                    <h2>{currentPuzzle.title}</h2>
                    <div className="puzzle-tags"><span>{currentPuzzle.theme}</span><span>{currentPuzzle.side} to move</span></div>
                    <p className="puzzle-prompt">{puzzleMessage}</p>
                    {puzzleSolved && <p className="puzzle-explanation">{currentPuzzle.explanation}</p>}
                    <button className="primary-button" type="button" onClick={() => loadPuzzle(puzzleIndex+1)}>Next puzzle →</button>
                    <button className="secondary-button" type="button" onClick={() => loadPuzzle(puzzleIndex)}>Restart puzzle</button>
                  </div>
                  <p className="study-disclaimer">Original ChessBox exercises. More puzzle sets and difficulty levels can be added as open data.</p>
                </> : <>
                  <div className="study-card">
                    <div className="sidebar-section-label">STOCKFISH ANALYSIS</div>
                    <h2>{analysis ? analysis.evaluation : analysisBusy ? "Analysing…" : "Ready to analyse"}</h2>
                    <p className="study-muted">{analysis ? "Depth " + analysis.depth : "Local browser engine · no server required"}</p>
                    {analysis?.line.length ? <div className="pv-line"><span>BEST LINE</span><p>{analysis.line.join("  ")}</p></div> : null}
                    <button className="primary-button" type="button" onClick={runAnalysis} disabled={!engineReady || analysisBusy || engineThinking || gameOver}>{analysisBusy ? "Analysing…" : "Analyse position"}</button>
                    {engineError && <p className="form-message">{engineError}</p>}
                  </div>
                  <div className="study-card">
                    <div className="sidebar-section-label">LOAD POSITION</div>
                    <label className="field-label" htmlFor="fen-input">FEN</label>
                    <textarea id="fen-input" className="data-input" rows={3} value={fenInput} onChange={event=>setFenInput(event.target.value)} placeholder="Paste a FEN position…"/>
                    <button className="secondary-button" type="button" onClick={loadFen}>Load FEN</button>
                    <label className="field-label" htmlFor="pgn-input">PGN</label>
                    <textarea id="pgn-input" className="data-input" rows={4} value={pgnInput} onChange={event=>setPgnInput(event.target.value)} placeholder="Paste a PGN game…"/>
                    <button className="secondary-button" type="button" onClick={loadPgn}>Load PGN</button>
                    {dataMessage && <p className="form-message">{dataMessage}</p>}
                  </div>
                </>}
              </aside>
            </div>
          </div>
        )}

        {screen === "learn" && (
          <div className="learn-page">
            <section className="study-heading"><div><span className="match-breadcrumb">CHESSBOX / LEARN</span><h1>Learn the game.</h1><p>Explore classic opening ideas and load their positions onto the board.</p></div></section>
            <section className="learning-grid">
              {OPENINGS.map(opening => (
                <article className="opening-card" key={opening.name}>
                  <div className="opening-meta"><span>{opening.eco}</span><span>{opening.style}</span></div>
                  <h2>{opening.name}</h2><div className="opening-line">{opening.moves}</div><p>{opening.note}</p>
                  <button className="primary-button" type="button" onClick={() => loadOpening(opening.pgn)}>Load position on board <span>↗</span></button>
                </article>
              ))}
            </section>
          </div>
        )}

        {(screen === "live" || screen === "community" || screen === "more") && (
          <div className="coming-soon-page">
            <span className="coming-soon-icon">{screen === "live" ? "◉" : screen === "community" ? "♧" : "•••"}</span>
            <span className="match-breadcrumb">CHESSBOX / {screen.toUpperCase()}</span>
            <h1>{screen === "live" ? "Live chess is on the roadmap." : screen === "community" ? "A community, built in the open." : "More is coming."}</h1>
            <p>{screen === "live" ? "Real-time matchmaking needs a multiplayer server. This Pages build stays fully static, so no fake online opponents are shown." : screen === "community" ? "ChessBox is open source. Follow development, report issues, or contribute through the project repository." : "More tools and settings will arrive as the project grows."}</p>
            <a href="https://github.com/ajxiye/chessbox" target="_blank" rel="noreferrer">Open the ChessBox repository ↗</a>
            <button className="primary-button" type="button" onClick={() => openScreen("play")}>Play against Stockfish</button>
          </div>
        )}
      </div>

      {dataMessage && screen === "home" && <div className="toast-message" role="status">{dataMessage}<button type="button" onClick={() => setDataMessage("")}>×</button></div>}
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
