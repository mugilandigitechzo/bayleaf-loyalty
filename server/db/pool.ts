import { PgConnection, PgError, type PgConfig, type QueryResult } from './pgwire.ts';

/** Anything that can run a query: the pool itself, or a connection inside a transaction. */
export interface Queryable {
  query<T = Record<string, any>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
}

export interface Db extends Queryable {
  transaction<T>(fn: (tx: Queryable) => Promise<T>, opts?: { retries?: number }): Promise<T>;
  simpleQuery(sql: string): Promise<void>;
  close(): Promise<void>;
}

export function createPool(cfg: PgConfig, max = 10): Db {
  const idle: PgConnection[] = [];
  const waiters: Array<(c: PgConnection) => void> = [];
  let total = 0;
  let closing = false;

  async function acquire(): Promise<PgConnection> {
    if (closing) throw new Error('Pool is closing');
    while (idle.length) {
      const c = idle.pop()!;
      if (!c.closed) return c;
      total--;
    }
    if (total < max) {
      total++;
      const c = new PgConnection(cfg);
      try { await c.connect(); } catch (e) { total--; throw e; }
      return c;
    }
    return new Promise((res) => waiters.push(res));
  }

  function release(c: PgConnection) {
    // After close(), connections handed back late (e.g. fire-and-forget updates) are ended, not pooled.
    if (closing && !c.closed) { c.end(); total--; return; }
    if (c.closed) {
      total--;
      // A connection died; let a waiter create a new one.
      const w = waiters.shift();
      if (w) acquire().then(w, () => { /* waiter retries on its own query */ });
      return;
    }
    const w = waiters.shift();
    if (w) w(c); else idle.push(c);
  }

  async function withConn<T>(fn: (c: PgConnection) => Promise<T>): Promise<T> {
    const c = await acquire();
    try { return await fn(c); } finally { release(c); }
  }

  const RETRYABLE = new Set(['40001', '40P01']); // serialization_failure, deadlock_detected

  return {
    query: (sql, params) => withConn((c) => c.query(sql, params)),
    simpleQuery: (sql) => withConn(async (c) => { await c.simpleQuery(sql); }),
    async transaction(fn, opts) {
      const retries = opts?.retries ?? 3;
      for (let attempt = 0; ; attempt++) {
        const c = await acquire();
        try {
          await c.query('BEGIN');
          const result = await fn({ query: (sql, params) => c.query(sql, params) });
          await c.query('COMMIT');
          return result;
        } catch (e) {
          if (!c.closed) { try { await c.query('ROLLBACK'); } catch { /* connection unusable */ } }
          if (e instanceof PgError && RETRYABLE.has(e.code) && attempt < retries) continue;
          throw e;
        } finally {
          release(c);
        }
      }
    },
    async close() {
      closing = true;
      for (const c of idle.splice(0)) c.end();
    },
  };
}

export { PgError };
