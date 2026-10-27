import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { config } from '../config.ts';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number, opts: crypto.ScryptOptions) => Promise<Buffer>;

/** URL-safe random token. 24 bytes = 192 bits of entropy. */
export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Keyed hash used for every lookup of a secret (tokens, sessions, OTP codes). */
export function hmac(value: string, purpose: string): Buffer {
  return crypto.createHmac('sha256', config.hashKey).update(purpose + ':' + value).digest();
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', config.encryptionKey, iv);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), body.toString('base64url')].join('.');
}

export function decrypt(enc: string): string {
  const [v, iv, tag, body] = enc.split('.');
  if (v !== 'v1') throw new Error('Unknown ciphertext version');
  const d = crypto.createDecipheriv('aes-256-gcm', config.encryptionKey, Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(body, 'base64url')), d.final()]).toString('utf8');
}

// ---------- passwords (scrypt; no native deps needed) ----------
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw.normalize('NFKC'), salt, 32, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, N, r, p, salt, key] = stored.split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(key, 'base64');
  const actual = await scrypt(pw.normalize('NFKC'), Buffer.from(salt, 'base64'), expected.length,
    { N: Number(N), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
  return crypto.timingSafeEqual(actual, expected);
}

/** A dummy hash so failed logins for unknown usernames take the same time. */
export const DUMMY_PASSWORD_HASH = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(32).toString('base64');

// ---------- human-facing codes ----------
// Crockford-style alphabet: no I, L, O, U — nothing staff can misread at the counter.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function randomCode(len: number): string {
  const bytes = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[bytes[i] & 31];
  return s;
}

/** Customer member code, e.g. BL7K3Q9M. Shown under the QR for manual lookup. */
export function newMemberCode(): string { return 'BL' + randomCode(6); }

/** Transaction references, e.g. V-8K2M4QXT (visit) or R-... (redemption). */
export function newReference(prefix: 'V' | 'R'): string { return `${prefix}-${randomCode(8)}`; }

/** Normalise a typed member code: "bl-7k3q 9m" -> "BL7K3Q9M", common misreads fixed. */
export function normaliseMemberCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s-]/g, '');
  if (!s.startsWith('BL')) return null;
  const rest = s.slice(2).replace(/O/g, '0').replace(/[IL]/g, '1');
  return /^[0-9A-HJKMNP-TV-Z]{6}$/.test(rest) ? 'BL' + rest : null;
}

export function sixDigitCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}
