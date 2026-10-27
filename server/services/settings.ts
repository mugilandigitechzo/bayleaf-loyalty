import { z } from 'zod';
import type { Queryable } from '../db/index.ts';
import { isValidTimeZone } from '../lib/time.ts';
import { audit, type Actor } from './audit.ts';

export const visitPolicySchema = z.object({
  maxVisitsPerDay: z.number().int().min(1).max(10),
  timeZone: z.string().refine(isValidTimeZone, 'Unknown time zone'),
  minimumBillAmount: z.number().min(0).max(100000).nullable(),
});
export type VisitPolicy = z.infer<typeof visitPolicySchema>;

export const businessSchema = z.object({
  name: z.string().trim().min(1).max(60),
  tagline: z.string().trim().max(80),
  currency: z.string().trim().min(3).max(3),
  selfRegistration: z.boolean(),
  shareMessage: z.string().trim().min(10).max(400)
    .refine((s) => s.includes('{link}'), 'The message must contain {link}'),
});
export type BusinessSettings = z.infer<typeof businessSchema>;

export const DEFAULTS = {
  visit_policy: { maxVisitsPerDay: 1, timeZone: 'Asia/Dubai', minimumBillAmount: null } as VisitPolicy,
  business: {
    name: 'Bay Leaf',
    tagline: 'Restaurant',
    currency: 'AED',
    selfRegistration: true,
    shareMessage: 'Welcome to Bay Leaf, {name}. Your loyalty card is ready — open it any time to see your visits and rewards: {link}',
  } as BusinessSettings,
};

type Key = keyof typeof DEFAULTS;
const schemas = { visit_policy: visitPolicySchema, business: businessSchema } as const;

export async function getSetting<K extends Key>(q: Queryable, key: K): Promise<(typeof DEFAULTS)[K]> {
  const r = await q.query<{ value: any }>('SELECT value FROM app_settings WHERE key = $1', [key]);
  return { ...DEFAULTS[key], ...(r.rows[0]?.value ?? {}) };
}

export async function updateSetting<K extends Key>(q: Queryable, key: K, patch: Partial<(typeof DEFAULTS)[K]>, actor: Actor, reason?: string) {
  const before = await getSetting(q, key);
  const next = schemas[key].parse({ ...before, ...patch }) as (typeof DEFAULTS)[K];
  await q.query(
    `INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES ($1, $2, now(), $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [key, next, actor.type === 'staff' ? actor.id : null],
  );
  await audit(q, actor, { action: 'settings.updated', entityType: 'setting', entityId: key, reason, details: { before, after: next } });
  return next;
}
