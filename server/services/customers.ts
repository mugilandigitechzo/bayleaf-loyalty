import type { Db, Queryable } from '../db/index.ts';
import { config } from '../config.ts';
import { Errors, AppError } from '../lib/errors.ts';
import { decrypt, encrypt, hmac, newMemberCode, normaliseMemberCode, randomToken } from '../lib/crypto.ts';
import { normalisePhone } from '../lib/phone.ts';
import { audit, type Actor } from './audit.ts';
import { ensureActiveCard, lockCustomer } from './loyalty.ts';
import { getSetting } from './settings.ts';
import type { ShareInfo } from '../../shared/types.ts';

export type TokenKind = 'qr' | 'link';

export function phoneOrThrow(input: string): string {
  const r = normalisePhone(input, config.defaultPhoneRegion);
  if (!r.ok) {
    const msg = r.reason === 'not_mobile' ? 'Enter a mobile number (not a landline).' : 'Enter a valid mobile number.';
    throw Errors.validation(msg, { fields: { phone: msg } });
  }
  return r.e164;
}

export function cleanName(input: string): string {
  const name = String(input ?? '').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 80) throw Errors.validation('Enter the guest’s name.', { fields: { name: 'Enter a name between 2 and 80 characters.' } });
  if (/[<>{}\\]/.test(name)) throw Errors.validation('Names cannot contain < > { } or \\.', { fields: { name: 'Remove special characters.' } });
  return name;
}

async function issueToken(tx: Queryable, customerId: string, kind: TokenKind): Promise<string> {
  const token = randomToken(24);
  await tx.query(
    'INSERT INTO customer_tokens (customer_id, kind, token_hash, token_enc) VALUES ($1,$2,$3,$4)',
    [customerId, kind, hmac(token, 'tok:' + kind), encrypt(token)]);
  return token;
}

export async function activeToken(q: Queryable, customerId: string, kind: TokenKind): Promise<string> {
  const r = (await q.query('SELECT token_enc FROM customer_tokens WHERE customer_id = $1 AND kind = $2 AND revoked_at IS NULL', [customerId, kind])).rows[0];
  if (!r) throw new AppError('INTEGRITY', 500, 'Customer has no active token.');
  return decrypt(r.token_enc);
}

/** Replace a customer's QR code or card link; the old one stops working immediately. */
export async function rotateToken(db: Db, customerId: string, kind: TokenKind, actor: Actor, reason: string) {
  return db.transaction(async (tx) => {
    await lockCustomer(tx, customerId);
    await tx.query(
      `UPDATE customer_tokens SET revoked_at = now(), revoked_reason = $3
        WHERE customer_id = $1 AND kind = $2 AND revoked_at IS NULL`, [customerId, kind, reason]);
    await issueToken(tx, customerId, kind);
    if (kind === 'link') {
      // Anyone viewing through the old link loses access too.
      await tx.query("UPDATE customer_sessions SET revoked_at = now() WHERE customer_id = $1 AND scope = 'link' AND revoked_at IS NULL", [customerId]);
    }
    await audit(tx, actor, { action: `customer.${kind}_rotated`, entityType: 'customer', entityId: customerId, customerId, reason });
  });
}

export type ResolveResult =
  | { status: 'ok'; customerId: string }
  | { status: 'revoked' }
  | { status: 'unknown' };

export async function resolveToken(q: Queryable, token: string, kind: TokenKind): Promise<ResolveResult> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return { status: 'unknown' };
  const r = (await q.query('SELECT customer_id, revoked_at FROM customer_tokens WHERE token_hash = $1 AND kind = $2',
    [hmac(token, 'tok:' + kind), kind])).rows[0];
  if (!r) return { status: 'unknown' };
  if (r.revoked_at) return { status: 'revoked' };
  return { status: 'ok', customerId: r.customer_id };
}

/** QR content. A URL, so a staff phone's own camera app can open it straight into the counter screen. */
export function qrPayload(token: string) { return `${config.appUrl}/s/${token}`; }
export function cardUrl(linkToken: string) { return `${config.appUrl}/c/${linkToken}`; }

/** Accept anything staff might scan or type: a QR URL, a raw token, a member code or a phone number. */
export function parseScan(input: string): { kind: 'qr'; token: string } | { kind: 'code'; code: string } | { kind: 'phone'; e164: string } | null {
  const s = String(input ?? '').trim();
  if (!s) return null;
  const urlMatch = s.match(/\/s\/([A-Za-z0-9_-]{20,64})\/?$/);
  if (urlMatch) return { kind: 'qr', token: urlMatch[1] };
  const code = normaliseMemberCode(s);
  if (code) return { kind: 'code', code };
  if (/^[A-Za-z0-9_-]{32}$/.test(s)) return { kind: 'qr', token: s };
  const p = normalisePhone(s, config.defaultPhoneRegion);
  if (p.ok) return { kind: 'phone', e164: p.e164 };
  return null;
}

/**
 * Create a customer with Card 1, QR code and card link — or return the existing
 * profile when that mobile number is already registered. Never creates a duplicate:
 * the phone column is UNIQUE and creation runs under ON CONFLICT DO NOTHING.
 */
export async function findOrCreateCustomer(db: Db, args: {
  name: string; phoneE164: string; via: 'staff' | 'self'; actor: Actor; staffId?: string | null; outletId?: string | null;
}): Promise<{ customerId: string; created: boolean }> {
  return db.transaction(async (tx) => {
    const existing = (await tx.query('SELECT id FROM customers WHERE phone_e164 = $1', [args.phoneE164])).rows[0];
    if (existing) return { customerId: existing.id, created: false };

    let row: any = null;
    for (let attempt = 0; attempt < 5 && !row; attempt++) {
      const r = await tx.query(
        `INSERT INTO customers (member_code, full_name, phone_e164, registered_via, registered_by_staff_id, registered_outlet_id)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT DO NOTHING RETURNING id`,
        [newMemberCode(), args.name, args.phoneE164, args.via, args.staffId ?? null, args.outletId ?? null]);
      row = r.rows[0];
      if (!row) {
        // Either the phone was registered concurrently, or a member code collided.
        const again = (await tx.query('SELECT id FROM customers WHERE phone_e164 = $1', [args.phoneE164])).rows[0];
        if (again) return { customerId: again.id, created: false };
      }
    }
    if (!row) throw new AppError('INTEGRITY', 500, 'Could not allocate a member code.');

    await lockCustomer(tx, row.id);
    await issueToken(tx, row.id, 'qr');
    await issueToken(tx, row.id, 'link');
    await ensureActiveCard(tx, row.id);
    await audit(tx, args.actor, {
      action: 'customer.registered', entityType: 'customer', entityId: row.id, customerId: row.id, outletId: args.outletId ?? null,
      details: { via: args.via },
    });
    return { customerId: row.id, created: true };
  });
}

export async function shareInfo(q: Queryable, customerId: string, opts: { toCustomerPhone?: boolean } = {}): Promise<ShareInfo> {
  const c = (await q.query('SELECT full_name, phone_e164 FROM customers WHERE id = $1', [customerId])).rows[0];
  if (!c) throw Errors.notFound('customer');
  const link = cardUrl(await activeToken(q, customerId, 'link'));
  const business = await getSetting(q, 'business');
  const message = business.shareMessage.replace('{name}', String(c.full_name).split(' ')[0]).replace('{link}', link);
  // Staff send it straight to the guest's own WhatsApp; guests share without a preset recipient.
  const base = opts.toCustomerPhone ? `https://wa.me/${c.phone_e164.replace('+', '')}` : 'https://wa.me/';
  return { cardUrl: link, whatsappUrl: `${base}?text=${encodeURIComponent(message)}`, message };
}
