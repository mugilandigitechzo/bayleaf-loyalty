import { z } from 'zod';
import type { Req, Router } from '../http/framework.ts';
import { rateLimit } from '../http/framework.ts';
import { getDb } from '../db/index.ts';
import { Errors, AppError } from '../lib/errors.ts';
import { buildState, recordVisit, redeemReward } from '../services/loyalty.ts';
import { cleanName, findOrCreateCustomer, parseScan, phoneOrThrow, resolveToken, shareInfo } from '../services/customers.ts';
import { changeOwnPassword, login, logout, STAFF_COOKIE, toMe, getStaffSession } from '../services/staffAuth.ts';
import { audit } from '../services/audit.ts';
import { getSetting } from '../services/settings.ts';
import { idempotencyKey, requireStaff, uuidParam } from './guards.ts';

/** Staff record visits for the outlet they are standing in. */
async function requireOutletIfAny(actorOutletId: string | null) {
  if (actorOutletId) return;
  const any = (await getDb().query('SELECT 1 FROM outlets WHERE is_active LIMIT 1')).rows[0];
  if (any) throw Errors.conflict('OUTLET_REQUIRED', 'Choose which outlet you are working at before recording visits.');
}

export function staffRoutes(r: Router) {
  r.post('/api/staff/login', async (req) => {
    const body = z.object({ username: z.string().max(60), password: z.string().max(200) }).parse(req.body);
    rateLimit('login-ip', req.ip, 20, 300);
    rateLimit('login-user', body.username.toLowerCase(), 10, 300);
    const s = await login(getDb(), body.username, body.password, { ip: req.ip, userAgent: req.userAgent });
    req.setCookie(STAFF_COOKIE, s.token, { maxAgeSec: s.maxAgeSec, sameSite: 'Lax' });
    const session = await getStaffSession(getDb(), s.token);
    return { me: toMe(session!) };
  });

  r.post('/api/staff/logout', async (req) => {
    const s = await getStaffSession(getDb(), req.cookies[STAFF_COOKIE]);
    if (s) await logout(getDb(), s.sessionId);
    req.clearCookie(STAFF_COOKIE);
    return { ok: true };
  });

  r.get('/api/staff/me', async (req) => {
    const { s } = await requireStaff(req, 'customer.lookup');
    const db = getDb();
    const policy = await getSetting(db, 'visit_policy');
    const business = await getSetting(db, 'business');
    const outletsExist = !!(await db.query('SELECT 1 FROM outlets WHERE is_active LIMIT 1')).rows[0];
    return { me: toMe(s), counter: { minimumBillAmount: policy.minimumBillAmount, currency: business.currency, outletRequired: outletsExist } };
  });

  r.post('/api/staff/password', async (req) => {
    const { s, actor } = await requireStaff(req, 'customer.lookup');
    const body = z.object({ current: z.string().max(200), next: z.string().max(200) }).parse(req.body);
    await changeOwnPassword(getDb(), s, body.current, body.next, actor);
    return { ok: true };
  });

  r.get('/api/staff/outlets', async (req) => {
    await requireStaff(req, 'customer.lookup');
    return (await getDb().query('SELECT id, name FROM outlets WHERE is_active ORDER BY name')).rows;
  });

  /** Admins can work the counter at any outlet; staff are fixed to their own. */
  r.post('/api/staff/outlet', async (req) => {
    const { s, actor } = await requireStaff(req, 'customer.lookup');
    if (s.user.role === 'staff') throw Errors.forbidden();
    const outletId = z.object({ outletId: z.string().uuid() }).parse(req.body).outletId;
    const o = (await getDb().query('SELECT id FROM outlets WHERE id = $1 AND is_active', [outletId])).rows[0];
    if (!o) throw Errors.notFound('outlet');
    await getDb().query('UPDATE staff_sessions SET outlet_id = $2 WHERE id = $1', [s.sessionId, outletId]);
    await audit(getDb(), actor, { action: 'staff.outlet_selected', entityType: 'outlet', entityId: outletId });
    const fresh = await getStaffSession(getDb(), req.cookies[STAFF_COOKIE]);
    return { me: toMe(fresh!) };
  });

  /**
   * Resolve a scanned QR, typed member code, or phone number to a customer.
   * Opening a customer NEVER records a visit — staff must confirm separately.
   */
  r.post('/api/staff/lookup', async (req) => {
    const { s } = await requireStaff(req, 'customer.lookup');
    rateLimit('lookup', s.user.id, 120, 60);
    const db = getDb();
    const parsed = parseScan(String(req.body?.input ?? ''));
    if (!parsed) return { found: false, reason: 'unrecognised' };
    let customerId: string | null = null;
    if (parsed.kind === 'qr') {
      const res = await resolveToken(db, parsed.token, 'qr');
      if (res.status === 'revoked') return { found: false, reason: 'revoked' };
      if (res.status !== 'ok') return { found: false, reason: 'unknown_qr' };
      customerId = res.customerId;
    } else if (parsed.kind === 'code') {
      customerId = (await db.query('SELECT id FROM customers WHERE member_code = $1', [parsed.code])).rows[0]?.id ?? null;
    } else {
      customerId = (await db.query('SELECT id FROM customers WHERE phone_e164 = $1', [parsed.e164])).rows[0]?.id ?? null;
    }
    if (!customerId) return { found: false, reason: parsed.kind === 'phone' ? 'no_phone_match' : 'no_code_match', phone: parsed.kind === 'phone' };
    return { found: true, state: await buildState(db, customerId) };
  });

  r.get('/api/staff/customers/:id', async (req) => {
    await requireStaff(req, 'customer.lookup');
    return { state: await buildState(getDb(), uuidParam(req, 'id', 'customer')) };
  });

  r.post('/api/staff/customers/:id/visits', async (req) => {
    const { actor } = await requireStaff(req, 'visit.record');
    await requireOutletIfAny(actor.outletId);
    const bill = req.body?.billAmount;
    const billAmount = bill === undefined || bill === null || bill === '' ? null : Number(bill);
    if (billAmount !== null && (!Number.isFinite(billAmount) || billAmount < 0 || billAmount > 1_000_000)) {
      throw Errors.validation('Enter the bill amount as a number.', { fields: { billAmount: 'Invalid amount' } });
    }
    return recordVisit(getDb(), { customerId: uuidParam(req, 'id', 'customer'), actor, idempotencyKey: idempotencyKey(req), billAmount });
  });

  r.post('/api/staff/rewards/:id/redeem', async (req) => {
    const { actor } = await requireStaff(req, 'reward.redeem');
    await requireOutletIfAny(actor.outletId);
    return redeemReward(getDb(), { customerRewardId: uuidParam(req, 'id', 'reward'), actor, idempotencyKey: idempotencyKey(req) });
  });

  r.post('/api/staff/customers', async (req) => {
    const { actor } = await requireStaff(req, 'customer.register');
    const body = z.object({ name: z.string().max(120), phone: z.string().max(40) }).parse(req.body);
    const db = getDb();
    const phone = phoneOrThrow(body.phone);
    const name = cleanName(body.name);
    const res = await findOrCreateCustomer(db, { name, phoneE164: phone, via: 'staff', actor, staffId: actor.id, outletId: actor.outletId });
    return { created: res.created, state: await buildState(db, res.customerId), share: await shareInfo(db, res.customerId, { toCustomerPhone: true }) };
  });

  r.get('/api/staff/customers/:id/share', async (req) => {
    await requireStaff(req, 'customer.lookup');
    return shareInfo(getDb(), uuidParam(req, 'id', 'customer'), { toCustomerPhone: true });
  });

  /** This staff member's own operations in the last 12 hours, for the counter's "recent" list. */
  r.get('/api/staff/recent', async (req: Req) => {
    const { s } = await requireStaff(req, 'customer.lookup');
    const rows = (await getDb().query(
      `SELECT DISTINCT ON (a.customer_id) a.customer_id, a.action, a.created_at, c.full_name, c.member_code,
              cc.visit_count, cc.required_visits
         FROM audit_events a JOIN customers c ON c.id = a.customer_id
         LEFT JOIN customer_cards cc ON cc.customer_id = c.id AND cc.status = 'active'
        WHERE a.actor_id = $1 AND a.created_at > now() - interval '12 hours'
          AND a.action IN ('visit.recorded', 'reward.redeemed', 'customer.registered')
        ORDER BY a.customer_id, a.created_at DESC`, [s.user.id])).rows;
    rows.sort((a: any, b: any) => +new Date(b.created_at) - +new Date(a.created_at));
    return rows.slice(0, 8).map((r: any) => ({
      customerId: r.customer_id, name: r.full_name, memberCode: r.member_code, action: r.action, at: r.created_at,
      progress: r.required_visits ? `${r.visit_count}/${r.required_visits}` : null,
    }));
  });
}

export { AppError };
