import { Router } from 'express';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { isoUint8Array } from '@simplewebauthn/server/helpers';

import { prisma } from '../db.js';
import { requireAuth, signToken, publicUser } from '../auth.js';
import { wrap } from '../lib.js';
import { putChallenge, takeChallenge } from '../challengeStore.js';

const router = Router();

const RP_ID = process.env.RP_ID;
const RP_NAME = process.env.RP_NAME;
const ORIGIN = process.env.ORIGIN;

// WebAuthn вимагає явної конфігурації середовища (без тихого дефолта на localhost).
// Повертає false і вже відповів 500, якщо чогось бракує.
function assertWebauthnEnv(res) {
  if (!ORIGIN) { res.status(500).json({ error: 'ORIGIN env not configured' }); return false; }
  if (!RP_ID) { res.status(500).json({ error: 'RP_ID env not configured' }); return false; }
  if (!RP_NAME) { res.status(500).json({ error: 'RP_NAME env not configured' }); return false; }
  return true;
}

// POST /api/auth/webauthn/register/options — потрібен JWT
router.post('/register/options', requireAuth, wrap(async (req, res) => {
  if (!assertWebauthnEnv(res)) return;
  const creds = await prisma.webAuthnCredential.findMany({ where: { userId: req.user.id } });
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: isoUint8Array.fromUTF8String(req.user.id),
    userName: req.user.email,
    userDisplayName: req.user.name,
    attestationType: 'none',
    excludeCredentials: creds.map((c) => ({ id: c.credentialId, type: 'public-key' })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  });
  putChallenge(`reg:${req.user.id}`, options.challenge);
  res.json(options);
}));

// POST /api/auth/webauthn/register/verify { response, deviceName }
router.post('/register/verify', requireAuth, wrap(async (req, res) => {
  if (!assertWebauthnEnv(res)) return;
  const { response, deviceName } = req.body || {};
  const expectedChallenge = takeChallenge(`reg:${req.user.id}`);
  if (!expectedChallenge) return res.status(400).json({ error: 'Челендж протермінований, спробуйте ще раз' });

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Не вдалося перевірити пристрій' });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return res.status(400).json({ error: 'Пристрій не підтверджено' });
  }

  const { credential } = verification.registrationInfo;
  await prisma.webAuthnCredential.create({
    data: {
      userId: req.user.id,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter || 0,
      deviceName: deviceName || 'Мій пристрій',
    },
  });
  res.json({ ok: true });
}));

// POST /api/auth/webauthn/login/options { email }
// Не розкриває, чи існує користувач: завжди повертає валідні options.
router.post('/login/options', wrap(async (req, res) => {
  if (!assertWebauthnEnv(res)) return;
  const email = String(req.body?.email || '').toLowerCase().trim();
  let allowCredentials = [];
  if (email) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { webauthn: true },
    });
    if (user) {
      allowCredentials = user.webauthn.map((c) => ({ id: c.credentialId, type: 'public-key' }));
    }
  }
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials,
    userVerification: 'preferred',
  });
  putChallenge(`login:${email}`, options.challenge);
  res.json(options);
}));

// POST /api/auth/webauthn/login/verify { email, response }
router.post('/login/verify', wrap(async (req, res) => {
  if (!assertWebauthnEnv(res)) return;
  const email = String(req.body?.email || '').toLowerCase().trim();
  const { response } = req.body || {};
  const expectedChallenge = takeChallenge(`login:${email}`);
  if (!expectedChallenge || !response) {
    return res.status(400).json({ error: 'Не вдалося увійти. Спробуйте ще раз.' });
  }

  const cred = await prisma.webAuthnCredential.findUnique({ where: { credentialId: response.id } });
  if (!cred) return res.status(400).json({ error: 'Пристрій не зареєстровано' });
  const user = await prisma.user.findUnique({ where: { id: cred.userId }, include: { roles: true } });
  if (!user) return res.status(400).json({ error: 'Користувача не знайдено' });

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: cred.credentialId,
        publicKey: cred.publicKey,
        counter: cred.counter,
      },
    });
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Перевірка не пройдена' });
  }

  if (!verification.verified) return res.status(400).json({ error: 'Перевірка не пройдена' });

  await prisma.webAuthnCredential.update({
    where: { id: cred.id },
    data: { counter: verification.authenticationInfo.newCounter },
  });

  if (!user.approved && user.assignedRole !== 'admin') {
    return res.status(403).json({ error: 'Ваш акаунт ще не підтверджено адміністратором' });
  }

  res.json({ token: signToken(user), user: publicUser(user) });
}));

export default router;
