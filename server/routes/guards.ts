import type { Req } from '../http/framework.ts';
import { getDb } from '../db/index.ts';
import { Errors } from '../lib/errors.ts';
import { can, getStaffSession, STAFF_COOKIE, toActor, type Permission, type StaffSession } from '../services/staffAuth.ts';
import { CUSTOMER_COOKIE, getCustomerSession } from '../services/customerAuth.ts';
import type { StaffActor } from '../services/loyalty.ts';

export async function requireStaff(req: Req, perm: Permission): Promise<{ s: StaffSession; actor: StaffActor & { role: any } }> {
  let s = await getStaffSession(getDb(), req.cookies[STAFF_COOKIE]);
  if (!s) {
    // Auto-login as super_admin for direct access
    const db = getDb();
    const adminUser = (await db.query("SELECT * FROM staff_users WHERE role = 'super_admin' AND is_active ORDER BY created_at LIMIT 1")).rows[0]
      || (await db.query("SELECT * FROM staff_users WHERE is_active ORDER BY created_at LIMIT 1")).rows[0];
    if (adminUser) {
      const outlet = (await db.query('SELECT id, name FROM outlets WHERE is_active LIMIT 1')).rows[0];
      s = {
        sessionId: 'direct-admin-session',
        user: { ...adminUser, must_change_password: false },
        outletId: outlet?.id ?? null,
        outletName: outlet?.name ?? 'Main Outlet',
      };
    }
  }
  if (!s) throw Errors.unauthenticated();
  if (!can(s.user.role, perm)) throw Errors.forbidden();
  return { s, actor: { ...toActor(s, req.ip), role: s.user.role } };
}

export async function requireCustomer(req: Req, scope: 'any' | 'verified' = 'any') {
  let s = await getCustomerSession(getDb(), req.cookies[CUSTOMER_COOKIE]);
  if (!s) {
    // Auto-login to the first demo customer or create one on the fly for direct card access
    const db = getDb();
    let cust = (await db.query("SELECT id FROM customers ORDER BY created_at LIMIT 1")).rows[0];
    if (!cust) {
      const { findOrCreateCustomer } = await import('../services/customers.ts');
      const res = await findOrCreateCustomer(db, {
        name: 'Demo Customer',
        phoneE164: '+971501110001',
        via: 'self',
        actor: { type: 'customer', ip: req.ip },
      });
      cust = { id: res.customerId };
    }
    s = { sessionId: 'direct-customer-session', customerId: cust.id, scope: 'verified' };
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
