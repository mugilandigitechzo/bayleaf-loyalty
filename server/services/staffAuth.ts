import type { Db, Queryable } from '../db/index.ts';
import { config } from '../config.ts';
import { Errors, AppError } from '../lib/errors.ts';
import { DUMMY_PASSWORD_HASH, hashPassword, hmac, randomToken, verifyPassword } from '../lib/crypto.ts';
import { audit, type Actor } from './audit.ts';
import type { StaffActor } from './loyalty.ts';
import type { StaffMe, StaffRole } from '../../shared/types.ts';

/** Server-side permission map. The UI hides what you can't do; this enforces it. */
const ALL: StaffRole[] = ['staff', 'admin', 'super_admin'];
const ADMINS: StaffRole[] = ['admin', 'super_admin'];
export const PERMISSIONS = {
  'customer.lookup': ALL,
  'customer.register': ALL,
  'visit.record': ALL,
  'reward.redeem': ALL,
  'customer.view_full': ADMINS,
  'customer.edit': ADMINS,
  'visit.correct': ADMINS,
  'reward.adjust': ADMINS,
  'card.configure': ADMINS,
  'reports.view': ADMINS,
  'audit.view': ADMINS,
  'staff.manage': ADMINS,
  'staff.manage_admins': ['super_admin'] as StaffRole[],
  'outlet.manage': ADMINS,
  'settings.manage': ADMINS,
} as const;
export type Permission = keyof typeof PERMISSIONS;

export function can(role: StaffRole, p: Permission) { return (PERMISSIONS[p] as readonly StaffRole[]).includes(role); }

export const STAFF_COOKIE = 'bl_staff';
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export async function validatePassword(pw: string) {
  if (typeof pw !== 'string' || pw.length < 10 || pw.length > 200) {
    throw Errors.validation('Use at least 10 characters for the password.', { fields: { password: 'At least 10 characters.' } });
  }
}

export async function login(db: Db, username: string, password: string, meta: { ip: string; userAgent: string }) {
  const u = (await db.query('SELECT * FROM staff_users WHERE lower(username) = lower($1)', [String(username ?? '').trim()])).rows[0];
  if (!u) {
    await verifyPassword(String(password ?? ''), DUMMY_PASSWORD_HASH); // equalise timing
    throw new AppError('BAD_CREDENTIALS', 401, 'That username and password don’t match.');
  }
  if (u.locked_until && new Date(u.locked_until) > new Date()) {
    throw new AppError('ACCOUNT_LOCKED', 423, 'Too many wrong passwords. Try again in 15 minutes or ask a manager to reset it.');
  }
  const ok = await verifyPassword(String(password ?? ''), u.password_hash);
  if (!ok || !u.is_active) {
    if (ok && !u.is_active) throw new AppError('ACCOUNT_DISABLED', 403, 'This staff account is switched off. Ask a manager.');
    const failed = u.failed_logins + 1;
    await db.query(
      `UPDATE staff_users SET failed_logins = $2::int,
              locked_until = CASE WHEN $3::boolean THEN now() + make_interval(mins => $4::int) ELSE NULL END WHERE id = $1`,
      [u.id, failed >= MAX_FAILED ? 0 : failed, failed >= MAX_FAILED, LOCK_MINUTES]);
    if (failed >= MAX_FAILED) {
      await audit(db, { type: 'system', ip: meta.ip }, { action: 'staff.locked_out', entityType: 'staff_user', entityId: u.id });
    }
    throw new AppError('BAD_CREDENTIALS', 401, 'That username and password don’t match.');
  }
  const token = randomToken(32);
  await db.transaction(async (tx) => {
    await tx.query('UPDATE staff_users SET failed_logins = 0, locked_until = NULL, last_login_at = now() WHERE id = $1', [u.id]);
    await tx.query(
      `INSERT INTO staff_sessions (token_hash, staff_id, outlet_id, expires_at, ip, user_agent)
       VALUES ($1,$2,$3, now() + ($4 || ' hours')::interval, $5, $6)`,
      [hmac(token, 'staff-session'), u.id, u.outlet_id, String(config.staffSessionHours), meta.ip, meta.userAgent]);
    await audit(tx, { type: 'staff', id: u.id, name: u.full_name, ip: meta.ip }, { action: 'staff.signed_in', entityType: 'staff_user', entityId: u.id });
  });
  return { token, maxAgeSec: config.staffSessionHours * 3600 };
}

export interface StaffSession { sessionId: string; user: any; outletId: string | null; outletName: string | null }

export async function getStaffSession(q: Queryable, token: string | undefined): Promise<StaffSession | null> {
  if (!token || token.length > 100) return null;
  const r = (await q.query(
    `SELECT s.id AS session_id, s.outlet_id AS session_outlet, o.name AS outlet_name, u.*
       FROM staff_sessions s JOIN staff_users u ON u.id = s.staff_id
       LEFT JOIN outlets o ON o.id = s.outlet_id
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.is_active`,
    [hmac(token, 'staff-session')])).rows[0];
  if (!r) return null;
  q.query('UPDATE staff_sessions SET last_seen_at = now() WHERE id = $1', [r.session_id]).catch(() => {});
  return { sessionId: r.session_id, user: r, outletId: r.session_outlet, outletName: r.outlet_name };
}

export function toMe(s: StaffSession): StaffMe {
  const role = s.user.role as StaffRole;
  return {
    id: s.user.id, fullName: s.user.full_name, username: s.user.username, role,
    outlet: s.outletId ? { id: s.outletId, name: s.outletName ?? '' } : null,
    permissions: (Object.keys(PERMISSIONS) as Permission[]).filter((p) => can(role, p)),
    mustChangePassword: s.user.must_change_password,
  };
}

export function toActor(s: StaffSession, ip?: string): StaffActor {
  return { type: 'staff', id: s.user.id, name: s.user.full_name, outletId: s.outletId, ip };
}

export async function logout(q: Queryable, sessionId: string) {
  await q.query('UPDATE staff_sessions SET revoked_at = now() WHERE id = $1', [sessionId]);
}

export async function changeOwnPassword(db: Db, s: StaffSession, current: string, next: string, actor: Actor) {
  if (!(await verifyPassword(String(current ?? ''), s.user.password_hash))) {
    throw Errors.validation('Your current password is not correct.', { fields: { current: 'Not correct.' } });
  }
  await validatePassword(next);
  const hash = await hashPassword(next);
  await db.transaction(async (tx) => {
    await tx.query('UPDATE staff_users SET password_hash = $2, must_change_password = false, updated_at = now() WHERE id = $1', [s.user.id, hash]);
    await tx.query('UPDATE staff_sessions SET revoked_at = now() WHERE staff_id = $1 AND id <> $2 AND revoked_at IS NULL', [s.user.id, s.sessionId]);
    await audit(tx, actor, { action: 'staff.password_changed', entityType: 'staff_user', entityId: s.user.id });
  });
}
