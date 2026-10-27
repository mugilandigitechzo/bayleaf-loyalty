import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.ts';
import { getDb, closeDb, type Db } from './index.ts';

const dir = path.join(config.root, 'server', 'db', 'migrations');

export async function migrate(db: Db = getDb(), log = true): Promise<string[]> {
  await db.simpleQuery(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  // Serialise concurrent migrators (e.g. two app instances booting together).
  return db.transaction(async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock(724501)');
    const done = new Set((await tx.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    const applied: string[] = [];
    for (const f of files) {
      if (done.has(f)) continue;
      const sql = fs.readFileSync(path.join(dir, f), 'utf8');
      await runScript(tx, sql);
      await tx.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
      applied.push(f);
      if (log) console.log(`[migrate] applied ${f}`);
    }
    if (log && applied.length === 0) console.log('[migrate] database is up to date');
    return applied;
  });
}

/** Split a SQL script into statements, respecting quotes and $$ bodies. */
export function splitSql(sql: string): string[] {
  const out: string[] = [];
  let cur = '', i = 0, inS = false, inDollar: string | null = null, inLine = false;
  while (i < sql.length) {
    const ch = sql[i];
    if (inLine) { if (ch === '\n') { inLine = false; cur += ch; } i++; continue; }
    if (inDollar) {
      if (sql.startsWith(inDollar, i)) { cur += inDollar; i += inDollar.length; inDollar = null; continue; }
      cur += ch; i++; continue;
    }
    if (inS) { cur += ch; if (ch === "'") inS = false; i++; continue; }
    if (ch === '-' && sql[i + 1] === '-') { inLine = true; i += 2; continue; }
    if (ch === "'") { inS = true; cur += ch; i++; continue; }
    if (ch === '$') {
      const m = sql.slice(i).match(/^\$[A-Za-z_]*\$/);
      if (m) { inDollar = m[0]; cur += m[0]; i += m[0].length; continue; }
    }
    if (ch === ';') { if (cur.trim()) out.push(cur.trim()); cur = ''; i++; continue; }
    cur += ch; i++;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

async function runScript(tx: { query: (s: string, p?: unknown[]) => Promise<unknown> }, sql: string) {
  for (const stmt of splitSql(sql)) await tx.query(stmt);
}

const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  migrate().then(() => closeDb()).catch(async (e) => { console.error(e); await closeDb(); process.exit(1); });
}
