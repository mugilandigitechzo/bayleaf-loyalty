/**
 * Minimal PostgreSQL client (wire protocol v3).
 *
 * Why this exists: the build environment for this project had no npm registry
 * access, so `pg` (node-postgres) could not be installed. This module covers
 * exactly what the app needs — SCRAM-SHA-256 / MD5 auth, optional TLS,
 * parameterised queries via the extended protocol, simple multi-statement
 * queries for migrations, and a small connection pool.
 *
 * Everything else in the app talks to the `Db` interface in ./pool.ts, so this
 * file can be swapped for node-postgres without touching business logic.
 */
import net from 'node:net';
import tls from 'node:tls';
import crypto from 'node:crypto';
import fs from 'node:fs';

export interface PgConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: false | 'prefer' | 'require' | 'verify-full';
  sslCaFile?: string;
  applicationName?: string;
}

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
  command: string;
}

export class PgError extends Error {
  code: string;
  detail?: string;
  constraint?: string;
  severity?: string;
  constructor(fields: Record<string, string>) {
    super(fields.M ?? 'PostgreSQL error');
    this.name = 'PgError';
    this.code = fields.C ?? 'XX000';
    this.detail = fields.D;
    this.constraint = fields.n;
    this.severity = fields.S;
  }
}

type Field = { name: string; typeOid: number };

// ---------- type parsing (text format) ----------
function parseTimestamp(s: string): Date {
  // e.g. "2026-10-27 09:54:34.318+00" or "2026-10-27 09:54:34+05:30"
  let iso = s.replace(' ', 'T');
  const m = iso.match(/([+-]\d{2})(:?\d{2})?$/);
  if (m) {
    const tz = m[2] ? m[1] + ':' + m[2].replace(':', '') : m[1] + ':00';
    iso = iso.slice(0, iso.length - m[0].length) + tz;
  }
  return new Date(iso);
}

function parseValue(raw: string, oid: number): unknown {
  switch (oid) {
    case 16: return raw === 't';
    case 17: return Buffer.from(raw.slice(2), 'hex'); // bytea (hex output format)
    case 20: case 21: case 23: case 26: {
      const n = Number(raw);
      return Number.isSafeInteger(n) ? n : raw;
    }
    case 700: case 701: case 1700: return Number(raw);
    case 114: case 3802: return JSON.parse(raw);
    case 1184: case 1114: return parseTimestamp(raw);
    case 1009: case 1015: return parseTextArray(raw);
    default: return raw; // text, varchar, uuid, date (YYYY-MM-DD), bytea (hex) ...
  }
}

function parseTextArray(raw: string): (string | null)[] {
  if (raw === '{}') return [];
  const out: (string | null)[] = [];
  let i = 1, cur = '', quoted = false, wasQuoted = false;
  while (i < raw.length) {
    const ch = raw[i];
    if (quoted) {
      if (ch === '\\') { cur += raw[i + 1]; i += 2; continue; }
      if (ch === '"') { quoted = false; i++; continue; }
      cur += ch; i++; continue;
    }
    if (ch === '"') { quoted = true; wasQuoted = true; i++; continue; }
    if (ch === ',' || ch === '}') {
      out.push(!wasQuoted && cur === 'NULL' ? null : cur);
      cur = ''; wasQuoted = false; i++; continue;
    }
    cur += ch; i++;
  }
  return out;
}

function serializeParam(v: unknown): Buffer | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return Buffer.from(v.toISOString());
  if (Buffer.isBuffer(v)) return Buffer.from('\\x' + v.toString('hex'));
  if (typeof v === 'boolean') return Buffer.from(v ? 't' : 'f');
  if (Array.isArray(v)) {
    const parts = v.map((x) => x === null || x === undefined ? 'NULL' : '"' + String(x).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"');
    return Buffer.from('{' + parts.join(',') + '}');
  }
  if (typeof v === 'object') return Buffer.from(JSON.stringify(v));
  return Buffer.from(String(v));
}

// ---------- message writers ----------
function cstr(s: string): Buffer { return Buffer.concat([Buffer.from(s, 'utf8'), Buffer.from([0])]); }
function msg(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(5);
  head.write(type, 0, 'ascii');
  head.writeInt32BE(body.length + 4, 1);
  return Buffer.concat([head, body]);
}
function int16(n: number) { const b = Buffer.alloc(2); b.writeInt16BE(n); return b; }
function int32(n: number) { const b = Buffer.alloc(4); b.writeInt32BE(n); return b; }

interface Pending {
  kind: 'extended' | 'simple';
  fields: Field[];
  rows: Record<string, unknown>[];
  command: string;
  rowCount: number;
  error?: PgError;
  resolve: (r: QueryResult<any>) => void;
  reject: (e: Error) => void;
}

export class PgConnection {
  private socket!: net.Socket | tls.TLSSocket;
  private buf: Buffer = Buffer.alloc(0);
  private queue: Array<() => void> = [];
  private busy = false;
  private current: Pending | null = null;
  private readyWaiter: { resolve: () => void; reject: (e: Error) => void } | null = null;
  private scram: { clientNonce: string; clientFirstBare: string; serverSig?: Buffer } | null = null;
  closed = false;
  txStatus = 'I';
  lastError: Error | null = null;

  constructor(private cfg: PgConfig) {}

  async connect(): Promise<void> {
    const raw = net.connect({ host: this.cfg.host, port: this.cfg.port });
    raw.setNoDelay(true);
    await new Promise<void>((res, rej) => { raw.once('connect', res); raw.once('error', rej); });

    if (this.cfg.ssl) {
      raw.write(Buffer.concat([int32(8), int32(80877103)]));
      const answer = await new Promise<string>((res, rej) => {
        raw.once("data", (d: Buffer) => res(String.fromCharCode(d[0])));
        raw.once('error', rej);
      });
      if (answer === 'S') {
        const opts: tls.ConnectionOptions = { socket: raw, servername: this.cfg.host };
        if (this.cfg.ssl === 'verify-full') {
          if (this.cfg.sslCaFile) opts.ca = fs.readFileSync(this.cfg.sslCaFile);
          opts.rejectUnauthorized = true;
        } else {
          opts.rejectUnauthorized = false; // 'prefer' / 'require': encrypted, not verified
        }
        const t = tls.connect(opts);
        await new Promise<void>((res, rej) => { t.once('secureConnect', res); t.once('error', rej); });
        this.socket = t;
      } else if (this.cfg.ssl === 'prefer') {
        this.socket = raw;
      } else {
        raw.destroy();
        throw new Error('Database server does not support TLS but DATABASE_SSL requires it');
      }
    } else {
      this.socket = raw;
    }

    this.socket.on('data', (d: Buffer) => this.onData(d));
    this.socket.on('error', (e) => this.fail(e));
    this.socket.on('close', () => { this.closed = true; this.fail(new Error('Database connection closed')); });

    const ready = new Promise<void>((resolve, reject) => { this.readyWaiter = { resolve, reject }; });
    const params = Buffer.concat([
      int32(196608),
      cstr('user'), cstr(this.cfg.user),
      cstr('database'), cstr(this.cfg.database),
      cstr('client_encoding'), cstr('UTF8'),
      cstr('TimeZone'), cstr('UTC'),
      cstr('DateStyle'), cstr('ISO, YMD'),
      cstr('application_name'), cstr(this.cfg.applicationName ?? 'bayleaf'),
      Buffer.from([0]),
    ]);
    this.socket.write(Buffer.concat([int32(params.length + 4), params]));
    await ready;
  }

  private fail(e: Error) {
    this.lastError = e;
    this.closed = true;
    if (this.readyWaiter) { this.readyWaiter.reject(e); this.readyWaiter = null; }
    if (this.current) { this.current.reject(e); this.current = null; }
  }

  private onData(d: Buffer) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    while (this.buf.length >= 5) {
      const len = this.buf.readInt32BE(1);
      if (this.buf.length < len + 1) break;
      const type = String.fromCharCode(this.buf[0]);
      const body = this.buf.subarray(5, len + 1);
      this.buf = this.buf.subarray(len + 1);
      try { this.handle(type, body); } catch (e) { this.fail(e as Error); }
    }
  }

  private handle(type: string, body: Buffer) {
    switch (type) {
      case 'R': return this.handleAuth(body);
      case 'S': case 'K': case 'N': case '1': case '2': case 'n': case 'I': case 's': return;
      case 'E': {
        const fields = parseFields(body);
        const err = new PgError(fields);
        if (this.readyWaiter) { this.readyWaiter.reject(err); this.readyWaiter = null; return; }
        if (this.current) this.current.error = err;
        return;
      }
      case 'T': {
        if (!this.current) return;
        const n = body.readInt16BE(0);
        let off = 2;
        const fields: Field[] = [];
        for (let i = 0; i < n; i++) {
          const end = body.indexOf(0, off);
          const name = body.toString('utf8', off, end);
          off = end + 1;
          const typeOid = body.readInt32BE(off + 6);
          off += 18;
          fields.push({ name, typeOid });
        }
        this.current.fields = fields;
        return;
      }
      case 'D': {
        if (!this.current) return;
        const n = body.readInt16BE(0);
        let off = 2;
        const row: Record<string, unknown> = {};
        for (let i = 0; i < n; i++) {
          const len = body.readInt32BE(off); off += 4;
          const f = this.current.fields[i];
          if (len === -1) { row[f.name] = null; continue; }
          row[f.name] = parseValue(body.toString('utf8', off, off + len), f.typeOid);
          off += len;
        }
        this.current.rows.push(row);
        return;
      }
      case 'C': {
        if (!this.current) return;
        const tag = body.toString('utf8', 0, body.length - 1);
        const parts = tag.split(' ');
        this.current.command = parts[0];
        const last = Number(parts[parts.length - 1]);
        this.current.rowCount = Number.isFinite(last) ? last : this.current.rows.length;
        return;
      }
      case 'Z': {
        this.txStatus = String.fromCharCode(body[0]);
        if (this.readyWaiter) { this.readyWaiter.resolve(); this.readyWaiter = null; return; }
        const p = this.current;
        this.current = null;
        if (p) {
          if (p.error) p.reject(p.error);
          else p.resolve({ rows: p.rows, rowCount: p.rowCount, command: p.command });
        }
        this.busy = false;
        const next = this.queue.shift();
        if (next) next();
        return;
      }
      default:
        return;
    }
  }

  private handleAuth(body: Buffer) {
    const code = body.readInt32BE(0);
    if (code === 0) return; // AuthenticationOk
    if (code === 3) {
      this.socket.write(msg('p', cstr(this.cfg.password)));
      return;
    }
    if (code === 5) {
      const salt = body.subarray(4, 8);
      const inner = crypto.createHash('md5').update(this.cfg.password + this.cfg.user).digest('hex');
      const outer = crypto.createHash('md5').update(Buffer.concat([Buffer.from(inner), salt])).digest('hex');
      this.socket.write(msg('p', cstr('md5' + outer)));
      return;
    }
    if (code === 10) {
      const mechs = body.toString('utf8', 4).split('\0').filter(Boolean);
      if (!mechs.includes('SCRAM-SHA-256')) throw new Error('Server requires unsupported SASL mechanism: ' + mechs.join(','));
      const clientNonce = crypto.randomBytes(18).toString('base64');
      const clientFirstBare = `n=*,r=${clientNonce}`;
      this.scram = { clientNonce, clientFirstBare };
      const data = Buffer.from('n,,' + clientFirstBare);
      this.socket.write(msg('p', Buffer.concat([cstr('SCRAM-SHA-256'), int32(data.length), data])));
      return;
    }
    if (code === 11) {
      if (!this.scram) throw new Error('Unexpected SASL continue');
      const serverFirst = body.toString('utf8', 4);
      const attrs = Object.fromEntries(serverFirst.split(',').map((kv) => [kv[0], kv.slice(2)]));
      const nonce = attrs.r, salt = Buffer.from(attrs.s, 'base64'), iter = Number(attrs.i);
      if (!nonce.startsWith(this.scram.clientNonce)) throw new Error('SCRAM nonce mismatch');
      const salted = crypto.pbkdf2Sync(this.cfg.password.normalize('NFKC'), salt, iter, 32, 'sha256');
      const hmac = (key: Buffer, s: string) => crypto.createHmac('sha256', key).update(s).digest();
      const clientKey = hmac(salted, 'Client Key');
      const storedKey = crypto.createHash('sha256').update(clientKey).digest();
      const withoutProof = `c=biws,r=${nonce}`;
      const authMessage = `${this.scram.clientFirstBare},${serverFirst},${withoutProof}`;
      const clientSig = hmac(storedKey, authMessage);
      const proof = Buffer.alloc(clientKey.length);
      for (let i = 0; i < proof.length; i++) proof[i] = clientKey[i] ^ clientSig[i];
      this.scram.serverSig = hmac(hmac(salted, 'Server Key'), authMessage);
      this.socket.write(msg('p', Buffer.from(`${withoutProof},p=${proof.toString('base64')}`)));
      return;
    }
    if (code === 12) {
      const final = body.toString('utf8', 4);
      const v = final.split(',').find((x) => x.startsWith('v='));
      if (!v || !this.scram?.serverSig || !crypto.timingSafeEqual(Buffer.from(v.slice(2), 'base64'), this.scram.serverSig)) {
        throw new Error('SCRAM server signature mismatch');
      }
      return;
    }
    throw new Error('Unsupported authentication method code ' + code);
  }

  private enqueue<T>(fn: (p: Pending) => void): Promise<QueryResult<T>> {
    return new Promise((resolve, reject) => {
      const run = () => {
        if (this.closed) { reject(this.lastError ?? new Error('Database connection closed')); return; }
        this.busy = true;
        const p: Pending = { kind: 'extended', fields: [], rows: [], command: '', rowCount: 0, resolve, reject };
        this.current = p;
        fn(p);
      };
      if (this.busy) this.queue.push(run); else run();
    });
  }

  query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    return this.enqueue<T>(() => {
      const values = params.map(serializeParam);
      const bindParts: Buffer[] = [cstr(''), cstr(''), int16(0), int16(values.length)];
      for (const v of values) {
        if (v === null) bindParts.push(int32(-1));
        else { bindParts.push(int32(v.length)); bindParts.push(v); }
      }
      bindParts.push(int16(0));
      this.socket.write(Buffer.concat([
        msg('P', Buffer.concat([cstr(''), cstr(sql), int16(0)])),
        msg('B', Buffer.concat(bindParts)),
        msg('D', Buffer.concat([Buffer.from('P'), cstr('')])),
        msg('E', Buffer.concat([cstr(''), int32(0)])),
        msg('S', Buffer.alloc(0)),
      ]));
    });
  }

  /** Simple protocol: allows multiple statements, no parameters. Used for migrations. */
  simpleQuery(sql: string): Promise<QueryResult> {
    return this.enqueue(() => { this.socket.write(msg('Q', cstr(sql))); });
  }

  end() {
    if (this.closed) return;
    try { this.socket.write(msg('X', Buffer.alloc(0))); } catch { /* ignore */ }
    this.socket.end();
    this.closed = true;
  }
}

function parseFields(body: Buffer): Record<string, string> {
  const out: Record<string, string> = {};
  let off = 0;
  while (off < body.length && body[off] !== 0) {
    const key = String.fromCharCode(body[off]);
    const end = body.indexOf(0, off + 1);
    out[key] = body.toString('utf8', off + 1, end);
    off = end + 1;
  }
  return out;
}

export function parseDatabaseUrl(url: string, ssl: PgConfig['ssl'], sslCaFile?: string): PgConfig {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.replace(/^\//, '')),
    ssl,
    sslCaFile,
  };
}
