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
import { putChallenge, takeChallenge } from '../challengeStore.js';

const router = Router();

const RP_ID = process.env.RP_ID;
const RP_NAME = process.env.RP_NAME;
const ORIGIN = process.env.ORIGIN;

// WebAuthn вимагає явної конфігурації середовища (без тихого дефолта на localhost).
function assertWebauthnEnv(res) {
  if (!ORIGIN) { res.status(500).json({ error: 'ORIGIN env not configured' }); return false; }
  if (!RP_ID) { res.status(500).json({ error: 'RP_ID env not configured' }); return false; }
  if (!RP_NAME) { res.status(500).json({ error: 'RP_NAME env not configured' }); return false; }
  return true;
}

// POST /api/auth/webauthn/register/options — потрібен JWT
router.post('/register/options', requireAuth, async (req, res) => {
  try {
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
  } catch (e) {
    console.error('[webauthn register options]', e);
    res.status(500).json({ error: e.message || 'WebAuthn error' });
  }
});

// POST /api/auth/webauthn/register/verify { response, deviceName }
router.post('/register/verify', requireAuth, async (req, res) => {
  try {
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

    const { verified, registrationInfo } = verification || {};
    if (!verified || !registrationInfo) {
      return res.status(400).json({ error: 'WebAuthn verification failed' });
    }

    // @simplewebauthn/server@10.0.1: плоскі поля registrationInfo
    // credentialID — вже рядок base64url; credentialPublicKey — Uint8Array
    const { credentialID, credentialPublicKey, counter } = registrationInfo;
    if (!credentialID || !credentialPublicKey) {
      return res.status(400).json({ error: 'WebAuthn: некоректні дані пристрою' });
    }

    await prisma.webAuthnCredential.create({
      data: {
        userId: req.user.id,
        credentialId: credentialID,
        publicKey: Buffer.from(credentialPublicKey),
        counter: counter || 0,
        deviceName: deviceName || 'Мій пристрій',
      },
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('[webauthn register verify]', e);
    res.status(500).json({ error: e.message || 'WebAuthn error' });
  }
});

// POST /api/auth/webauthn/login/options { email }
// Не розкриває, чи існує користувач: завжди повертає валідні options.
router.post('/login/options', async (req, res) => {
  try {
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
  } catch (e) {
    console.error('[webauthn login options]', e);
    res.status(500).json({ error: e.message || 'WebAuthn error' });
  }
});

// POST /api/auth/webauthn/login/verify { email, response }
router.post('/login/verify', async (req, res) => {
  try {
    if (!assertWebauthnEnv(res)) return;
    const email = String(req.body?.email || '').toLowerCase().trim();
    const { response } = req.body || {};
    const expectedChallenge = takeChallenge(`login:${email}`);
    if (!expectedChallenge || !response || !response.id) {
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
        // v10.0.1: параметр зветься `authenticator` з плоскими полями
        authenticator: {
          credentialID: cred.credentialId,
          credentialPublicKey: cred.publicKey,
          counter: cred.counter,
        },
      });
    } catch (e) {
      return res.status(400).json({ error: e.message || 'Перевірка не пройдена' });
    }

    if (!verification || !verification.verified) {
      return res.status(400).json({ error: 'Перевірка не пройдена' });
    }

    await prisma.webAuthnCredential.update({
      where: { id: cred.id },
      data: { counter: verification.authenticationInfo?.newCounter ?? cred.counter },
    });

    if (!user.approved && user.assignedRole !== 'admin') {
      return res.status(403).json({ error: 'Ваш акаунт ще не підтверджено адміністратором' });
    }

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    console.error('[webauthn login verify]', e);
    res.status(500).json({ error: e.message || 'WebAuthn error' });
  }
});

export default router;
