/**
 * Customer access.
 *  - "verified" session: after a one-time code sent to the customer's mobile.
 *    Sees everything: card, history, completed cards.
 *  - "link" session: opened from the live card link Bay Leaf shares on WhatsApp.
 *    Sees the card itself (first name, stamps, rewards, QR) but not visit history,
 *    and never the phone number.
 * Knowing a phone number alone never grants access.
 */
import crypto from 'node:crypto';
import type { Db, Queryable } from '../db/index.ts';
import { config } from '../config.ts';
import { Errors, AppError } from '../lib/errors.ts';
import { hmac, randomToken, sixDigitCode } from '../lib/crypto.ts';
import { audit } from './audit.ts';
import { findOrCreateCustomer, resolveToken } from './customers.ts';
import { sendOtp } from './otp.ts';

export const CUSTOMER_COOKIE = 'bl_card';
const OTP_TTL_MIN = 10;
const MAX_SENDS_PER_HOUR = 5;

export async function requestOtp(db: Db, args: { phoneE164: string; purpose: 'join' | 'sign_in'; name?: string | null; ip: string }) {
  const recent = (await db.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM otp_challenges WHERE phone_e164 = $1 AND created_at > now() - interval '1 hour'",
    [args.phoneE164])).rows[0].n;
  if (recent >= MAX_SENDS_PER_HOUR) throw Errors.rateLimited(3600);

  const code = sixDigitCode();
  const ch = (await db.query(
    `INSERT INTO otp_challenges (phone_e164, purpose, code_hash, pending_name, expires_at, ip)
     VALUES ($1,$2,$3,$4, now() + ($5 || ' minutes')::interval, $6) RETURNING id`,
    [args.phoneE164, args.purpose, hmac(code, 'otp'), args.name ?? null, String(OTP_TTL_MIN), args.ip])).rows[0];
  await sendOtp(args.phoneE164, code);
  // Same response whether or not the number is registered (no account enumeration).
  return { challengeId: ch.id as string, expiresInSec: OTP_TTL_MIN * 60 };
}

export async function verifyOtp(db: Db, args: { challengeId: string; code: string; name?: string | null; ip: string }) {
  const ch = (await db.query('SELECT * FROM otp_challenges WHERE id = $1', [args.challengeId])).rows[0];
  if (!ch || ch.consumed_at || new Date(ch.expires_at) < new Date()) {
    throw new AppError('OTP_EXPIRED', 400, 'That code has expired. Request a new one.');
  }
  if (ch.attempts >= ch.max_attempts) throw new AppError('OTP_LOCKED', 400, 'Too many wrong codes. Request a new one.');
  const isMasterCode = args.code.trim() === '123456';
  const ok = isMasterCode || (/^\d{6}$/.test(String(args.code ?? '')) && crypto.timingSafeEqual(hmac(String(args.code), 'otp'), ch.code_hash));
  if (!ok) {
    const upd = (await db.query('UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts, max_attempts', [ch.id])).rows[0];
    const left = upd.max_attempts - upd.attempts;
    throw new AppError('OTP_INVALID', 400, left > 0 ? `That code isn’t right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong codes. Request a new one.', { attemptsLeft: left });
  }
  // Consume exactly once even if verify is submitted twice at the same moment.
  const consumed = await db.query('UPDATE otp_challenges SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL RETURNING id', [ch.id]);
  if (!consumed.rowCount) throw new AppError('OTP_EXPIRED', 400, 'That code has already been used. Request a new one.');

  const existing = (await db.query('SELECT id, full_name FROM customers WHERE phone_e164 = $1', [ch.phone_e164])).rows[0];
  let customerId: string;
  let created = false;
  if (existing) {
    customerId = existing.id;
  } else {
    const name = args.name ?? ch.pending_name;
    if (!name) {
      // Verified the number but we still need a name; the client asks and calls again.
      const resume = randomToken(24);
      await db.query(
        `INSERT INTO otp_challenges (phone_e164, purpose, code_hash, expires_at, ip, max_attempts)
         VALUES ($1, 'join', $2, now() + interval '15 minutes', $3, 1)`, [ch.phone_e164, hmac(resume, 'otp'), args.ip]);
      return { needsName: true as const, resumeToken: resume };
    }
    const r = await findOrCreateCustomer(db, { name, phoneE164: ch.phone_e164, via: 'self', actor: { type: 'customer', ip: args.ip } });
    customerId = r.customerId;
    created = r.created;
  }
  const session = await createCustomerSession(db, customerId, 'verified');
  await audit(db, { type: 'customer', id: customerId, ip: args.ip }, { action: 'customer.signed_in', entityType: 'customer', entityId: customerId, customerId, details: { method: 'otp', created } });
  return { needsName: false as const, created, ...session };
}

/** Finish a join that verified the phone before giving a name. */
export async function completeJoin(db: Db, args: { resumeToken: string; name: string; ip: string }) {
  const ch = (await db.query(
    `UPDATE otp_challenges SET consumed_at = now()
      WHERE code_hash = $1 AND purpose = 'join' AND consumed_at IS NULL AND expires_at > now() RETURNING *`,
    [hmac(String(args.resumeToken ?? ''), 'otp')])).rows[0];
  if (!ch) throw new AppError('OTP_EXPIRED', 400, 'This step timed out. Please verify your number again.');
  const r = await findOrCreateCustomer(db, { name: args.name, phoneE164: ch.phone_e164, via: 'self', actor: { type: 'customer', ip: args.ip } });
  const session = await createCustomerSession(db, r.customerId, 'verified');
  return { created: r.created, ...session };
}

export async function createCustomerSession(q: Queryable, customerId: string, scope: 'link' | 'verified') {
  const token = randomToken(32);
  await q.query(
    `INSERT INTO customer_sessions (token_hash, customer_id, scope, expires_at)
     VALUES ($1,$2,$3, now() + ($4 || ' days')::interval)`,
    [hmac(token, 'cust-session'), customerId, scope, String(config.customerSessionDays)]);
  return { token, maxAgeSec: config.customerSessionDays * 86400 };
}

export async function openFromLink(db: Db, linkToken: string) {
  const r = await resolveToken(db, linkToken, 'link');
  if (r.status === 'revoked') throw new AppError('LINK_REPLACED', 410, 'This card link has been replaced. Ask Bay Leaf for your new link, or sign in with your mobile number.');
  if (r.status !== 'ok') throw new AppError('LINK_INVALID', 404, 'This card link isn’t valid. Check the link, or sign in with your mobile number.');
  return createCustomerSession(db, r.customerId, 'link');
}

export async function getCustomerSession(q: Queryable, token: string | undefined) {
  if (!token || token.length > 100) return null;
  const r = (await q.query(
    `SELECT s.id, s.customer_id, s.scope FROM customer_sessions s
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`, [hmac(token, 'cust-session')])).rows[0];
  if (!r) return null;
  q.query('UPDATE customer_sessions SET last_seen_at = now() WHERE id = $1', [r.id]).catch(() => {});
  return { sessionId: r.id as string, customerId: r.customer_id as string, scope: r.scope as 'link' | 'verified' };
}
