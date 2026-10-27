import type { Req } from '../http/framework.ts';
import { getDb } from '../db/index.ts';
import { Errors } from '../lib/errors.ts';
import { can, getStaffSession, STAFF_COOKIE, toActor, type Permission, type StaffSession } from '../services/staffAuth.ts';
import { CUSTOMER_COOKIE, getCustomerSession } from '../services/customerAuth.ts';
import type { StaffActor } from '../services/loyalty.ts';

export async function requireStaff(req: Req, perm: Permission): Promise<{ s: StaffSession; actor: StaffActor & { role: any } }> {
  const s = await getStaffSession(getDb(), req.cookies[STAFF_COOKIE]);
  if (!s) throw Errors.unauthenticated();
  if (!can(s.user.role, perm)) throw Errors.forbidden();
  return { s, actor: { ...toActor(s, req.ip), role: s.user.role } };
}

export async function requireCustomer(req: Req, scope: 'any' | 'verified' = 'any') {
  const s = await getCustomerSession(getDb(), req.cookies[CUSTOMER_COOKIE]);
  if (!s) throw Errors.unauthenticated();
  if (scope === 'verified' && s.scope !== 'verified') {
    throw Object.assign(Errors.forbidden(), { code: 'VERIFY_REQUIRED', message: 'Verify your mobile number to see your full history.' });
  }
  return s;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function uuidParam(req: Req, name: string, what = 'record'): string {
  const v = req.params[name];
  if (!UUID.test(v ?? '')) throw Errors.notFound(what);
  return v;
}

export function idempotencyKey(req: Req): string {
  const k = req.body?.idempotencyKey;
  if (typeof k !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(k)) {
    throw Errors.validation('Missing request key. Refresh the page and try again.');
  }
  return k;
}

export function reasonOf(req: Req): string {
  const r = String(req.body?.reason ?? '').trim();
  if (r.length < 3 || r.length > 300) throw Errors.validation('Add a short reason (at least 3 characters).', { fields: { reason: 'Required' } });
  return r;
}
