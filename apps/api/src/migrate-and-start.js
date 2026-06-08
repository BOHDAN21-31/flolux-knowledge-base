import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { prisma } from './db.js';
import { seedTopics, seedLocations, seedRoles, seedSpecialTopics, seedPermissions, seedPresets, seedCompanyDocs } from './seed.js';
import { initTelegram, setupWebhook } from './services/telegram.js';

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

function warnWebauthnEnv() {
  const missing = ['ORIGIN', 'RP_ID', 'RP_NAME'].filter((k) => !process.env[k]);
  if (missing.length) {
    console.warn(`[startup] УВАГА: не задано ${missing.join(', ')} — WebAuthn (Touch/Face ID) не працюватиме`);
  }
}

async function main() {
  warnWebauthnEnv();

  try {
    await prisma.$connect();
    console.log('[startup] підключено до БД');
  } catch (e) {
    console.error('[startup] помилка підключення до БД:', e.message);
  }

  await runMigrateDeploy();

  try {
    await seedRoles();
    await seedTopics();
    await seedSpecialTopics();
    await seedLocations();
    await seedPermissions();
    await seedPresets();
    await seedCompanyDocs();
  } catch (e) {
    console.error('[startup] seed помилка:', e.message);
  }

  await import('./index.js');

  try {
    initTelegram();
    await setupWebhook();
  } catch (e) {
    console.error('[startup] Telegram init failed:', e.message);
  }
}

main();
