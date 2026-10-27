import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildApp } from '../server/app.ts';
import { migrate } from '../server/db/migrate.ts';
import { getDb } from '../server/db/index.ts';

let migrated = false;
const app = buildApp({ serveWeb: false });

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!migrated) {
    try {
      await migrate(getDb(), false);
      migrated = true;
    } catch (e) {
      console.error('Migration failed on Vercel:', e);
    }
  }
  app.emit('request', req, res);
}
