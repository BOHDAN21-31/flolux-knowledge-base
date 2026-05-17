import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { prisma } from './db.js';
import { seedTopics } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_ROOT = path.join(__dirname, '..');

function runMigrateDeploy() {
  return new Promise((resolve) => {
    const child = spawn('npx', ['prisma', 'migrate', 'deploy'], {
      cwd: API_ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('close', (code) => {
      if (code !== 0) console.error(`[startup] prisma migrate deploy завершився з кодом ${code}`);
      resolve(code);
    });
    child.on('error', (err) => {
      console.error('[startup] не вдалося запустити prisma migrate deploy:', err.message);
      resolve(1);
    });
  });
}

async function main() {
  try {
    await prisma.$connect();
    console.log('[startup] підключено до БД');
  } catch (e) {
    console.error('[startup] помилка підключення до БД:', e.message);
  }

  await runMigrateDeploy();

  try {
    await seedTopics();
  } catch (e) {
    console.error('[startup] seed помилка:', e.message);
  }

  await import('./index.js');
}

main();
