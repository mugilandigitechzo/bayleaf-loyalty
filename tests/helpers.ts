import './env.ts';
import type { AddressInfo } from 'node:net';
import crypto from 'node:crypto';
import { buildApp } from '../server/app.ts';
import { getDb, closeDb } from '../server/db/index.ts';
import { seed } from '../server/db/seed.ts';
import { config } from '../server/config.ts';
import { lastTestOtp } from '../server/services/otp.ts';
import { resetRateLimits } from '../server/http/framework.ts';
import { setClockOffset } from '../server/lib/time.ts';

export const ADMIN_PASSWORD = 'test-owner-password-123';
export { getDb, lastTestOtp, setClockOffset, resetRateLimits };

let server: ReturnType<typeof buildApp> | null = null;
export let baseUrl = '';

export async function resetDatabase() {
  const db = getDb();
  await db.simpleQuery(`DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;`);
  await db.simpleQuery('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  await seed({ log: false, adminPassword: ADMIN_PASSWORD });
  await db.query("UPDATE staff_users SET must_change_password = false");
  resetRateLimits();
  setClockOffset(0);
}

export async function startServer(opts: { serveWeb?: boolean } = {}) {
  if (server) return baseUrl;
  server = buildApp({ serveWeb: opts.serveWeb ?? false });
  await new Promise<void>((res) => server!.listen(Number(config.port), '127.0.0.1', res));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return baseUrl;
}

export async function stopServer() {
  if (server) { await new Promise((r) => server!.close(r)); server = null; }
  await closeDb();
}

/** A browser-like client with its own cookie jar. */
export class Client {
  cookies = new Map<string, string>();
  async req(method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}) {
    const headers: Record<string, string> = { Origin: config.appOrigin, ...extraHeaders };
    if (method !== 'GET' && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    if (method !== 'GET' && body === undefined) body = {};
    if (this.cookies.size) headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(baseUrl + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';');
      const i = kv.indexOf('=');
      const k = kv.slice(0, i), v = kv.slice(i + 1);
      if (/Max-Age=0/.test(c)) this.cookies.delete(k); else this.cookies.set(k, v);
    }
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, body: json, headers: res.headers };
  }
  get(p: string) { return this.req('GET', p); }
  post(p: string, b?: unknown) { return this.req('POST', p, b ?? {}); }
  patch(p: string, b?: unknown) { return this.req('PATCH', p, b ?? {}); }
}

export function key() { return crypto.randomBytes(16).toString('hex'); }

export async function staffClient(username = 'owner', password = ADMIN_PASSWORD) {
  resetRateLimits(); // tests sign in far more often than a real counter would
  const c = new Client();
  const r = await c.post('/api/staff/login', { username, password });
  if (r.status !== 200) throw new Error('login failed: ' + JSON.stringify(r.body));
  return c;
}

let phoneSeq = 1000;
export function newPhone() { phoneSeq++; return `+97155${String(phoneSeq).padStart(7, '0')}`; }

export async function registerAtCounter(staff: Client, name = 'Test Guest', phone = newPhone()) {
  const r = await staff.post('/api/staff/customers', { name, phone });
  if (r.status !== 200) throw new Error('register failed: ' + JSON.stringify(r.body));
  return { id: r.body.state.customer.id as string, phone, body: r.body };
}

/** Record `n` visits on consecutive past days so the one-per-day rule is respected. */
export async function visitDays(staff: Client, customerId: string, n: number, startDaysAgo = n) {
  let last: any;
  for (let i = 0; i < n; i++) {
    setClockOffset(-(startDaysAgo - i) * 86400_000);
    last = await staff.post(`/api/staff/customers/${customerId}/visits`, { idempotencyKey: key() });
    if (last.status !== 200) { setClockOffset(0); throw new Error('visit failed: ' + JSON.stringify(last.body)); }
  }
  setClockOffset(0);
  return last.body;
}

export async function createStaffUser(admin: Client, role: 'staff' | 'admin', username: string) {
  const outlets = (await admin.get('/api/admin/outlets')).body;
  const r = await admin.post('/api/admin/staff', { fullName: username, username, role, outletId: outlets[0].id, password: 'counter-pass-123' });
  if (r.status !== 200) throw new Error('create staff failed: ' + JSON.stringify(r.body));
  await getDb().query('UPDATE staff_users SET must_change_password = false WHERE username = $1', [username]);
  return staffClient(username, 'counter-pass-123');
}

/** QR token for a customer, read the way the customer's screen gets it. */
export async function qrTokenFor(customerId: string) {
  const { activeToken } = await import('../server/services/customers.ts');
  return activeToken(getDb(), customerId, 'qr');
}
export async function linkTokenFor(customerId: string) {
  const { activeToken } = await import('../server/services/customers.ts');
  return activeToken(getDb(), customerId, 'link');
}
