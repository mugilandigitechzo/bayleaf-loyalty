/**
 * Recovery tool: create a super admin, or reset one's password, from the server shell.
 * Usage: npm run create-admin -- <username> "<Full Name>"
 * The new password is generated and printed once; it must be changed at first sign-in.
 */
import { getDb, closeDb } from './index.ts';
import { hashPassword, randomToken } from '../lib/crypto.ts';
import { audit } from '../services/audit.ts';

const [username, fullName] = process.argv.slice(2);
if (!username || !/^[a-z0-9._-]{3,40}$/.test(username)) {
  console.error('Usage: npm run create-admin -- <username> "<Full Name>"');
  process.exit(1);
}
const db = getDb();
const password = randomToken(12);
const hash = await hashPassword(password);
await db.transaction(async (tx) => {
  const r = await tx.query(
    `INSERT INTO staff_users (full_name, username, password_hash, role, must_change_password)
     VALUES ($1, $2, $3, 'super_admin', true)
     ON CONFLICT (lower(username)) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'super_admin',
       is_active = true, must_change_password = true, failed_logins = 0, locked_until = NULL, updated_at = now()
     RETURNING id`, [fullName || username, username, hash]);
  await tx.query('UPDATE staff_sessions SET revoked_at = now() WHERE staff_id = $1 AND revoked_at IS NULL', [r.rows[0].id]);
  await audit(tx, { type: 'system', name: 'create-admin CLI' }, { action: 'staff.admin_reset_cli', entityType: 'staff_user', entityId: r.rows[0].id });
});
console.log(`Super admin "${username}" ready. Temporary password (shown once): ${password}`);
await closeDb();
