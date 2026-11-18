import { ChessGame } from "@/components/chess-game";

export default function HomePage() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="ChessBox home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <rect x="2" y="2" width="28" height="28" rx="7" fill="currentColor" />
              <path d="M8 8h7v7H8zM17 17h7v7h-7z" fill="#20272C" />
              <path d="M17 8h7v7h-7zM8 17h7v7H8z" fill="#E9EDE8" />
            </svg>
          </span>
          <span className="brand-name">chessbox</span>
        </a>

        <nav className="topbar-nav" aria-label="Main navigation">
          <span className="nav-current"><span className="nav-dot" /> Play</span>
        </nav>

        <a
          className="github-link"
          href="https://github.com/ajxiye/chessbox"
          target="_blank"
          rel="noreferrer"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.56.1.76-.24.76-.54v-2.1c-3.1.68-3.75-1.32-3.75-1.32-.5-1.3-1.24-1.65-1.24-1.65-1.01-.7.08-.69.08-.69 1.12.08 1.7 1.15 1.7 1.15.99 1.7 2.6 1.21 3.23.93.1-.72.39-1.21.7-1.49-2.48-.28-5.08-1.24-5.08-5.52 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.05 1.14a10.6 10.6 0 0 1 5.56 0c2.12-1.44 3.05-1.14 3.05-1.14.61 1.54.23 2.68.12 2.96.72.78 1.15 1.78 1.15 3.01 0 4.29-2.61 5.23-5.1 5.5.4.35.75 1.02.75 2.06v3.12c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z"
            />
          </svg>
          <span>GitHub</span>
          <span className="external-arrow" aria-hidden="true">↗</span>
        </a>
      </header>

      <div className="page-content">
        <section className="page-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> THE CHESSBOX BOARD</div>
            <h1>Play chess.</h1>
            <p>A clear board, considered details, and room to think.</p>
          </div>
          <div className="build-label"><span className="status-dot" /> LOCAL GAME</div>
        </section>

        <ChessGame />

        <footer className="page-footer">
          <span>ChessBox <span className="footer-separator">/</span> Open source chess</span>
          <span>Made for the love of the game.</span>
        </footer>
      </div>
    </main>
  );
}
