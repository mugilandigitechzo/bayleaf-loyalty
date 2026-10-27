import { z } from 'zod';
import type { Router } from '../http/framework.ts';
import { getDb } from '../db/index.ts';
import { Errors } from '../lib/errors.ts';
import { businessDate, now } from '../lib/time.ts';
import {
  addCorrectionVisit, buildState, redemptionHistory, setRewardRevoked, undoLastVisit, visitHistory,
} from '../services/loyalty.ts';
import { rotateToken, shareInfo } from '../services/customers.ts';
import {
  addReward, archiveReward, createCard, listCards, publishCard, unpublishCard, updateCard, updateReward,
} from '../services/cardConfig.ts';
import {
  auditLog, createStaff, customerProfile, dashboard, editCustomer, listOutlets, listStaff, saveOutlet,
  searchCustomers, updateStaff,
} from '../services/admin.ts';
import { getSetting, updateSetting } from '../services/settings.ts';
import { reasonOf, requireStaff, uuidParam } from './guards.ts';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function adminRoutes(r: Router) {
  // ---------- dashboard ----------
  r.get('/api/admin/dashboard', async (req) => {
    await requireStaff(req, 'reports.view');
    const db = getDb();
    const tz = (await getSetting(db, 'visit_policy')).timeZone;
    const today = businessDate(now(), tz);
    const from = req.query.get('from') ?? '';
    const to = req.query.get('to') ?? '';
    const range = DATE.test(from) && DATE.test(to) && from <= to
      ? { from, to }
      : { from: businessDate(new Date(now().getTime() - 29 * 86400_000), tz), to: today };
    if ((Date.parse(range.to) - Date.parse(range.from)) / 86400_000 > 366) throw Errors.validation('Choose a range of one year or less.');
    return dashboard(db, range);
  });

  // ---------- customers ----------
  r.get('/api/admin/customers', async (req) => {
    await requireStaff(req, 'customer.view_full');
    return searchCustomers(getDb(), req.query.get('q') ?? '', { offset: Number(req.query.get('offset') ?? 0) || 0 });
  });

  r.get('/api/admin/customers/:id', async (req) => {
    await requireStaff(req, 'customer.view_full');
    const db = getDb();
    const id = uuidParam(req, 'id', 'customer');
    const [profile, state, visits, redemptions, history] = await Promise.all([
      customerProfile(db, id), buildState(db, id),
      visitHistory(db, id, { limit: 25, includeStaff: true, includeVoided: true }),
      redemptionHistory(db, id, { includeStaff: true }),
      auditLog(db, { customerId: id, limit: 30 }),
    ]);
    return { profile, state, visits, redemptions, audit: history };
  });

  r.get('/api/admin/customers/:id/visits', async (req) => {
    await requireStaff(req, 'customer.view_full');
    const before = req.query.get('before');
    return visitHistory(getDb(), uuidParam(req, 'id', 'customer'), {
      limit: 25, includeStaff: true, includeVoided: true, before: before && !isNaN(Date.parse(before)) ? before : undefined,
    });
  });

  r.patch('/api/admin/customers/:id', async (req) => {
    const { actor } = await requireStaff(req, 'customer.edit');
    await editCustomer(getDb(), uuidParam(req, 'id', 'customer'), req.body, actor);
    return { ok: true };
  });

  r.get('/api/admin/customers/:id/share', async (req) => {
    await requireStaff(req, 'customer.view_full');
    return shareInfo(getDb(), uuidParam(req, 'id', 'customer'), { toCustomerPhone: true });
  });

  r.post('/api/admin/customers/:id/visits/correction', async (req) => {
    const { actor } = await requireStaff(req, 'visit.correct');
    const date = String(req.body?.date ?? '');
    if (!DATE.test(date)) throw Errors.validation('Choose the date of the visit.', { fields: { date: 'Required' } });
    return addCorrectionVisit(getDb(), { customerId: uuidParam(req, 'id', 'customer'), actor, date, reason: reasonOf(req) });
  });

  r.post('/api/admin/customers/:id/visits/undo', async (req) => {
    const { actor } = await requireStaff(req, 'visit.correct');
    return { state: await undoLastVisit(getDb(), { customerId: uuidParam(req, 'id', 'customer'), actor, reason: reasonOf(req) }) };
  });

  r.post('/api/admin/customer-rewards/:id/revoke', async (req) => {
    const { actor } = await requireStaff(req, 'reward.adjust');
    return { state: await setRewardRevoked(getDb(), { customerRewardId: uuidParam(req, 'id', 'reward'), actor, revoke: true, reason: reasonOf(req) }) };
  });

  r.post('/api/admin/customer-rewards/:id/restore', async (req) => {
    const { actor } = await requireStaff(req, 'reward.adjust');
    return { state: await setRewardRevoked(getDb(), { customerRewardId: uuidParam(req, 'id', 'reward'), actor, revoke: false, reason: reasonOf(req) }) };
  });

  r.post('/api/admin/customers/:id/rotate', async (req) => {
    const { actor } = await requireStaff(req, 'customer.edit');
    const kind = z.object({ kind: z.enum(['qr', 'link']) }).parse(req.body).kind;
    await rotateToken(getDb(), uuidParam(req, 'id', 'customer'), kind, actor, reasonOf(req));
    return { ok: true };
  });

  // ---------- cards & rewards ----------
  r.get('/api/admin/cards', async (req) => {
    await requireStaff(req, 'card.configure');
    return listCards(getDb());
  });
  r.post('/api/admin/cards', async (req) => {
    const { actor } = await requireStaff(req, 'card.configure');
    return { id: await createCard(getDb(), req.body, actor) };
  });
  r.patch('/api/admin/cards/:id', async (req) => {
    const { actor } = await requireStaff(req, 'card.configure');
    const { reason, ...rest } = req.body ?? {};
    await updateCard(getDb(), uuidParam(req, 'id', 'card'), rest, actor, typeof reason === 'string' ? reason : undefined);
    return { ok: true };
  });
  r.post('/api/admin/cards/:id/publish', async (req) => {
    const { actor } = await requireStaff(req, 'card.configure');
    return publishCard(getDb(), uuidParam(req, 'id', 'card'), actor);
  });
  r.post('/api/admin/cards/:id/unpublish', async (req) => {
    const { actor } = await requireStaff(req, 'card.configure');
    await unpublishCard(getDb(), uuidParam(req, 'id', 'card'), actor);
    return { ok: true };
  });
  r.post('/api/admin/cards/:id/rewards', async (req) => {
    const { actor } = await requireStaff(req, 'card.configure');
    return { id: await addReward(getDb(), uuidParam(req, 'id', 'card'), req.body, actor) };
  });
  r.patch('/api/admin/rewards/:id', async (req) => {
    const { actor } = await requireStaff(req, 'card.configure');
    const { reason, ...rest } = req.body ?? {};
    await updateReward(getDb(), uuidParam(req, 'id', 'reward'), rest, actor, typeof reason === 'string' ? reason : undefined);
    return { ok: true };
  });
  r.post('/api/admin/rewards/:id/archive', async (req) => {
    const { actor } = await requireStaff(req, 'card.configure');
    await archiveReward(getDb(), uuidParam(req, 'id', 'reward'), actor, reasonOf(req));
    return { ok: true };
  });

  // ---------- staff & outlets ----------
  r.get('/api/admin/staff', async (req) => {
    await requireStaff(req, 'staff.manage');
    return listStaff(getDb());
  });
  r.post('/api/admin/staff', async (req) => {
    const { actor } = await requireStaff(req, 'staff.manage');
    return { id: await createStaff(getDb(), req.body, actor) };
  });
  r.patch('/api/admin/staff/:id', async (req) => {
    const { actor } = await requireStaff(req, 'staff.manage');
    await updateStaff(getDb(), uuidParam(req, 'id', 'staff member'), req.body, actor);
    return { ok: true };
  });
  r.get('/api/admin/outlets', async (req) => {
    await requireStaff(req, 'outlet.manage');
    return listOutlets(getDb());
  });
  r.post('/api/admin/outlets', async (req) => {
    const { actor } = await requireStaff(req, 'outlet.manage');
    return { id: await saveOutlet(getDb(), null, req.body, actor) };
  });
  r.patch('/api/admin/outlets/:id', async (req) => {
    const { actor } = await requireStaff(req, 'outlet.manage');
    await saveOutlet(getDb(), uuidParam(req, 'id', 'outlet'), req.body, actor);
    return { ok: true };
  });

  // ---------- settings ----------
  r.get('/api/admin/settings', async (req) => {
    await requireStaff(req, 'settings.manage');
    const db = getDb();
    return { visitPolicy: await getSetting(db, 'visit_policy'), business: await getSetting(db, 'business') };
  });
  r.patch('/api/admin/settings/:key', async (req) => {
    const { actor } = await requireStaff(req, 'settings.manage');
    const key = req.params.key === 'visit-policy' ? 'visit_policy' : req.params.key === 'business' ? 'business' : null;
    if (!key) throw Errors.notFound('setting');
    const { reason, ...patch } = req.body ?? {};
    return updateSetting(getDb(), key, patch, actor, typeof reason === 'string' ? reason : undefined);
  });

  // ---------- audit ----------
  r.get('/api/admin/audit', async (req) => {
    await requireStaff(req, 'audit.view');
    return auditLog(getDb(), {
      customerId: req.query.get('customerId') ?? undefined,
      action: req.query.get('action') ?? undefined,
      before: req.query.get('before') ?? undefined,
    });
  });
}
