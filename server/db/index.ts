import { config } from '../config.ts';
import { parseDatabaseUrl } from './pgwire.ts';
import { createPool, type Db } from './pool.ts';

let db: Db | null = null;

export function getDb(): Db {
  if (!db) {
    const ssl = config.databaseSsl === 'false' ? false : config.databaseSsl;
    db = createPool(parseDatabaseUrl(config.databaseUrl, ssl, config.databaseSslCaFile), config.databasePoolSize);
  }
  return db;
}

export async function closeDb() {
  if (db) { await db.close(); db = null; }
}

export type { Db, Queryable } from './pool.ts';
