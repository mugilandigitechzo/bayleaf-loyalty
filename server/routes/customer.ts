import { z } from 'zod';
import type { Router } from '../http/framework.ts';
import { rateLimit } from '../http/framework.ts';
import { getDb } from '../db/index.ts';
import { config } from '../config.ts';
import { Errors } from '../lib/errors.ts';
import { qrSvg } from '../lib/qr.ts';
import { getSetting } from '../services/settings.ts';
import { buildState, redemptionHistory, visitHistory } from '../services/loyalty.ts';
import { activeToken, cleanName, phoneOrThrow, qrPayload, resolveToken, shareInfo } from '../services/customers.ts';
import {
  CUSTOMER_COOKIE, completeJoin, getCustomerSession, openFromLink, requestOtp, verifyOtp,
} from '../services/customerAuth.ts';
import { requireCustomer } from './guards.ts';
import type { LoyaltyState } from '../../shared/types.ts';

/** What a "link" (WhatsApp) session may see: no full name, no phone digits. */
function limitForLink(state: LoyaltyState): LoyaltyState {
  return { ...state, customer: { ...state.customer, fullName: state.customer.firstName, phoneMasked: '' } };
}

export function customerRoutes(r: Router) {
  r.get('/api/public/config', async () => {
    const b = await getSetting(getDb(), 'business');
    return { name: b.name, tagline: b.tagline, selfRegistration: b.selfRegistration, arabicEnabled: config.enableArabic, phoneRegion: config.defaultPhoneRegion };
  });

  r.post('/api/customer/otp/request', async (req) => {
    rateLimit('otp-req-ip', req.ip, 10, 600);
    const body = z.object({ phone: z.string().max(40), name: z.string().max(120).optional(), purpose: z.enum(['join', 'sign_in']) }).parse(req.body);
    const db = getDb();
    if (body.purpose === 'join') {
      const b = await getSetting(db, 'business');
      if (!b.selfRegistration) throw Errors.conflict('SELF_REGISTRATION_OFF', 'Please ask Bay Leaf staff to register you at the counter.');
    }
    const phone = phoneOrThrow(body.phone);
    const name = body.purpose === 'join' ? cleanName(body.name ?? '') : null;
    rateLimit('otp-req-phone', phone, 3, 600);
    return requestOtp(db, { phoneE164: phone, purpose: body.purpose, name, ip: req.ip });
  });

  r.post('/api/customer/otp/verify', async (req) => {
    rateLimit('otp-verify-ip', req.ip, 30, 600);
    const body = z.object({ challengeId: z.string().uuid('Request a new code.'), code: z.string().max(10) }).parse(req.body);
    const result = await verifyOtp(getDb(), { challengeId: body.challengeId, code: body.code.trim(), ip: req.ip });
    if (result.needsName) return { needsName: true, resumeToken: result.resumeToken };
    req.setCookie(CUSTOMER_COOKIE, result.token, { maxAgeSec: result.maxAgeSec });
    return { needsName: false, created: result.created };
  });

  r.post('/api/customer/join/complete', async (req) => {
    rateLimit('otp-verify-ip', req.ip, 30, 600);
    const body = z.object({ resumeToken: z.string().max(100), name: z.string().max(120) }).parse(req.body);
    const result = await completeJoin(getDb(), { resumeToken: body.resumeToken, name: cleanName(body.name), ip: req.ip });
    req.setCookie(CUSTOMER_COOKIE, result.token, { maxAgeSec: result.maxAgeSec });
    return { created: result.created };
  });

  r.post('/api/customer/link', async (req) => {
    rateLimit('link-ip', req.ip, 30, 60);
    const token = String(req.body?.token ?? '');
    const db = getDb();
    // Already fully signed in on this device? Keep the stronger session.
    const existing = req.cookies[CUSTOMER_COOKIE];
    if (existing) {
      const s = await getCustomerSession(db, existing);
      const r2 = await resolveToken(db, token, 'link');
      if (s && s.scope === 'verified' && r2.status === 'ok' && r2.customerId === s.customerId) return { ok: true };
    }
    const session = await openFromLink(db, token);
    req.setCookie(CUSTOMER_COOKIE, session.token, { maxAgeSec: session.maxAgeSec });
    return { ok: true };
  });

  r.get('/api/customer/me', async (req) => {
    const s = await requireCustomer(req);
    const state = await buildState(getDb(), s.customerId);
    return { scope: s.scope, state: s.scope === 'verified' ? state : limitForLink(state) };
  });

  r.get('/api/customer/qr.svg', async (req) => {
    const s = await requireCustomer(req);
    const token = await activeToken(getDb(), s.customerId, 'qr');
    return { raw: qrSvg(qrPayload(token), { ecc: 'Q', border: 2 }), contentType: 'image/svg+xml' };
  });

  r.get('/api/customer/history', async (req) => {
    const s = await requireCustomer(req, 'verified');
    const db = getDb();
    const before = req.query.get('before');
    const visits = await visitHistory(db, s.customerId, { limit: 20, before: before && !isNaN(Date.parse(before)) ? before : undefined });
    const redemptions = before ? [] : await redemptionHistory(db, s.customerId);
    return { visits, redemptions };
  });

  r.get('/api/customer/share', async (req) => {
    const s = await requireCustomer(req);
    return shareInfo(getDb(), s.customerId);
  });

  r.post('/api/customer/logout', async (req) => {
    const s = await requireCustomer(req).catch(() => null);
    if (s) await getDb().query('UPDATE customer_sessions SET revoked_at = now() WHERE id = $1', [s.sessionId]);
    req.clearCookie(CUSTOMER_COOKIE);
    return { ok: true };
  });
}
