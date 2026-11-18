import { cp, mkdir, access, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "node_modules", "stockfish", "bin");
const destination = path.join(root, "public", "engine");
const files = ["stockfish-19-lite-single.js", "stockfish-19-lite-single.wasm"];

await mkdir(destination, { recursive: true });
for (const file of files) {
  const from = path.join(source, file);
  const to = path.join(destination, file);
  await access(from);
  await cp(from, to);
  console.log("Copied Stockfish asset:", file);
}
await writeFile(path.join(destination, "NOTICE.txt"),
  "Stockfish.js 19.0.1, lite single-threaded WebAssembly build.\n" +
  "Licence: GNU General Public License version 3.0 (GPL-3.0).\n" +
  "Source: https://github.com/nmrugg/stockfish.js/tree/v19.0.1\n" +
  "Upstream engine: https://github.com/official-stockfish/Stockfish\n" +
  "The engine is distributed as a separate Web Worker and is not modified by ChessBox.\n" +
  "Full licence: https://www.gnu.org/licenses/gpl-3.0.txt\n"
);
