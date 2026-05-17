// Копіює зібраний фронтенд (apps/web/dist) у apps/api/public,
// звідки Express віддає його як SPA.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '../../web/dist');
const DEST = path.resolve(__dirname, '../public');

if (!fs.existsSync(SRC)) {
  console.error(`[copy:web] немає зібраного фронтенду: ${SRC}. Спершу npm run build -w apps/web`);
  process.exit(1);
}

fs.rmSync(DEST, { recursive: true, force: true });
fs.cpSync(SRC, DEST, { recursive: true });
console.log(`[copy:web] ${SRC} -> ${DEST}`);
