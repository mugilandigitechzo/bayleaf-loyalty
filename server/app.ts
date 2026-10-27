import path from 'node:path';
import { Router, createHttpServer } from './http/framework.ts';
import { customerRoutes } from './routes/customer.ts';
import { staffRoutes } from './routes/staff.ts';
import { adminRoutes } from './routes/admin.ts';
import { getDb } from './db/index.ts';
import { config } from './config.ts';

export function buildApp(opts: { serveWeb?: boolean } = {}) {
  const router = new Router();
  router.get('/api/health', async () => {
    await getDb().query('SELECT 1');
    return { ok: true };
  });
  customerRoutes(router);
  staffRoutes(router);
  adminRoutes(router);
  return createHttpServer(router, { webRoot: opts.serveWeb === false ? undefined : path.join(config.root, 'dist', 'web') });
}
