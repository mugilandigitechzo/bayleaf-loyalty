import { config, assertProductionSafety } from './config.ts';
import { buildApp } from './app.ts';
import { migrate } from './db/migrate.ts';
import { closeDb, getDb } from './db/index.ts';

assertProductionSafety();

if (process.env.MIGRATE_ON_START !== 'false') await migrate(getDb());

const server = buildApp();
server.listen(config.port, config.host, () => {
  console.log(`[bayleaf] listening on ${config.host}:${config.port} — open ${config.appUrl}`);
  if (config.otpProvider === 'console') console.log('[bayleaf] OTP codes print to this console (development mode).');
});

async function shutdown(sig: string) {
  console.log(`[bayleaf] ${sig} received, closing`);
  server.close();
  await closeDb();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
