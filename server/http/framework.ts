import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ZodError } from 'zod';
import { AppError, Errors } from '../lib/errors.ts';
import { config } from '../config.ts';

export interface Req {
  method: string;
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
  body: any;
  headers: http.IncomingHttpHeaders;
  cookies: Record<string, string>;
  ip: string;
  userAgent: string;
  /** Filled by auth helpers. */
  ctx: Record<string, any>;
  setCookie(name: string, value: string, opts: CookieOpts): void;
  clearCookie(name: string): void;
}

export interface CookieOpts { maxAgeSec?: number; httpOnly?: boolean; sameSite?: 'Lax' | 'Strict'; path?: string }

export type Reply =
  | { status?: number; json: unknown; headers?: Record<string, string> }
  | { status?: number; raw: string | Buffer; contentType: string; headers?: Record<string, string> };

export type Handler = (req: Req) => Promise<Reply | unknown>;

interface Route { method: string; parts: string[]; handler: Handler }

export class Router {
  routes: Route[] = [];
  add(method: string, pattern: string, handler: Handler) {
    this.routes.push({ method, parts: pattern.split('/').filter(Boolean), handler });
  }
  get(p: string, h: Handler) { this.add('GET', p, h); }
  post(p: string, h: Handler) { this.add('POST', p, h); }
  patch(p: string, h: Handler) { this.add('PATCH', p, h); }
  delete(p: string, h: Handler) { this.add('DELETE', p, h); }

  match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | 'method' | null {
    const segs = pathname.split('/').filter(Boolean);
    let methodMismatch = false;
    for (const r of this.routes) {
      if (r.parts.length !== segs.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < segs.length; i++) {
        if (r.parts[i].startsWith(':')) {
          try { params[r.parts[i].slice(1)] = decodeURIComponent(segs[i]); } catch { ok = false; break; }
        } else if (r.parts[i] !== segs[i]) { ok = false; break; }
      }
      if (!ok) continue;
      if (r.method !== method) { methodMismatch = true; continue; }
      return { handler: r.handler, params };
    }
    return methodMismatch ? 'method' : null;
  }
}

// ---------- rate limiting (fixed window, in memory) ----------
// One process is the supported MVP topology. Behind multiple instances, move this
// to a shared store (Redis / Postgres) — see docs/DEPLOYMENT.md.
const buckets = new Map<string, { count: number; resetAt: number }>();
setInterval(() => {
  const t = Date.now();
  for (const [k, v] of buckets) if (v.resetAt < t) buckets.delete(k);
}, 60_000).unref();

export function rateLimit(bucket: string, key: string, max: number, windowSec: number) {
  const k = `${bucket}:${key}`;
  const t = Date.now();
  let b = buckets.get(k);
  if (!b || b.resetAt < t) { b = { count: 0, resetAt: t + windowSec * 1000 }; buckets.set(k, b); }
  b.count++;
  if (b.count > max) throw Errors.rateLimited(Math.ceil((b.resetAt - t) / 1000));
}
export function resetRateLimits() { buckets.clear(); }

// ---------- helpers ----------
function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* ignore malformed */ }
  }
  return out;
}

function securityHeaders(res: http.ServerResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=()');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; '));
  if (config.isProd) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

/** Paths that carry secrets in the URL are never written to logs verbatim. */
export function redactPath(p: string): string {
  return p.replace(/^\/(s|c)\/[^/?#]+/, '/$1/[token]');
}

async function readJson(req: http.IncomingMessage, limit = 64 * 1024): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > limit) throw new AppError('PAYLOAD_TOO_LARGE', 413, 'Request is too large.');
    chunks.push(c as Buffer);
  }
  if (!size) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Errors.validation('Request body is not valid JSON.'); }
}

function sendJson(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(payload);
}

// ---------- static files ----------
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.map': 'application/json',
};

function serveStatic(webRoot: string, pathname: string, res: http.ServerResponse): boolean {
  const safe = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let file = path.join(webRoot, safe);
  if (!file.startsWith(webRoot)) return false;
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    // SPA fallback for app routes (no file extension).
    if (path.extname(pathname)) return false;
    file = path.join(webRoot, 'index.html');
    if (!fs.existsSync(file)) return false;
  }
  const ext = path.extname(file);
  const immutable = /\/assets\/.+-[A-Z0-9]{8}\./i.test(file);
  res.writeHead(200, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache' : immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
  });
  fs.createReadStream(file).pipe(res);
  return true;
}

// ---------- server ----------
export function createHttpServer(router: Router, opts: { webRoot?: string } = {}) {
  return http.createServer(async (rawReq, res) => {
    const started = Date.now();
    const url = new URL(rawReq.url ?? '/', 'http://local');
    const method = (rawReq.method ?? 'GET').toUpperCase();
    const fwd = rawReq.headers['x-forwarded-for'];
    const ip = (config.trustProxy && typeof fwd === 'string' ? fwd.split(',')[0].trim() : rawReq.socket.remoteAddress) ?? 'unknown';
    securityHeaders(res);

    const pending: string[] = [];
    const req: Req = {
      method, path: url.pathname, params: {}, query: url.searchParams, body: {},
      headers: rawReq.headers, cookies: parseCookies(rawReq.headers.cookie), ip,
      userAgent: String(rawReq.headers['user-agent'] ?? '').slice(0, 200), ctx: {},
      setCookie(name, value, o) {
        const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${o.path ?? '/'}`, `SameSite=${o.sameSite ?? 'Lax'}`];
        if (o.httpOnly !== false) parts.push('HttpOnly');
        if (config.isProd || config.appUrl.startsWith('https://')) parts.push('Secure');
        if (o.maxAgeSec !== undefined) parts.push(`Max-Age=${o.maxAgeSec}`);
        pending.push(parts.join('; '));
      },
      clearCookie(name) { pending.push(`${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`); },
    };

    try {
      if (url.pathname.startsWith('/api/')) {
        // CSRF defence: state-changing requests must be same-origin JSON.
        if (method !== 'GET' && method !== 'HEAD') {
          const origin = rawReq.headers.origin;
          const host = rawReq.headers.host;
          // Allow same host or matching appOrigin across all environments/domains
          if (origin) {
            try {
              const originHost = new URL(origin).host;
              if (host && originHost !== host && origin !== config.appOrigin) {
                // Also allow vercel.app and localhost subdomains
                if (!originHost.endsWith('.vercel.app') && !originHost.includes('localhost') && !originHost.endsWith('.onrender.com')) {
                  throw new AppError('BAD_ORIGIN', 403, 'Request origin not allowed.');
                }
              }
            } catch {
              // ignore URL parse errors
            }
          }
          const ct = String(rawReq.headers['content-type'] ?? '');
          if (!ct.startsWith('application/json')) throw new AppError('BAD_CONTENT_TYPE', 415, 'Requests must be JSON.');
          req.body = await readJson(rawReq);
        }
        const m = router.match(method, url.pathname);
        if (m === null) throw Errors.notFound('page');
        if (m === 'method') throw new AppError('METHOD_NOT_ALLOWED', 405, 'Method not allowed.');
        req.params = m.params;
        const out = await m.handler(req);
        if (pending.length) res.setHeader('Set-Cookie', pending);
        if (out && typeof out === 'object' && 'raw' in (out as any)) {
          const r = out as { status?: number; raw: string | Buffer; contentType: string; headers?: Record<string, string> };
          res.writeHead(r.status ?? 200, { 'Content-Type': r.contentType, 'Cache-Control': 'no-store', ...(r.headers ?? {}) });
          res.end(r.raw);
        } else if (out && typeof out === 'object' && 'json' in (out as any)) {
          const r = out as { status?: number; json: unknown; headers?: Record<string, string> };
          sendJson(res, r.status ?? 200, r.json, r.headers);
        } else {
          sendJson(res, 200, out ?? { ok: true });
        }
      } else if (method === 'GET' || method === 'HEAD') {
        if (!opts.webRoot || !serveStatic(opts.webRoot, url.pathname, res)) {
          res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found');
        }
      } else {
        res.writeHead(405); res.end();
      }
    } catch (e) {
      if (pending.length && !res.headersSent) res.setHeader('Set-Cookie', pending);
      const { status, body } = toErrorResponse(e);
      if (status >= 500) console.error('[error]', method, redactPath(url.pathname), e);
      if (!res.headersSent) sendJson(res, status, body, status === 429 ? { 'Retry-After': String((body.error.details as any).retryAfterSec ?? 60) } : {});
      else res.end();
    } finally {
      if (config.logRequests) {
        res.on('finish', () => console.log(`${method} ${redactPath(url.pathname)} ${res.statusCode} ${Date.now() - started}ms`));
      }
    }
  });
}

export function toErrorResponse(e: unknown): { status: number; body: { error: { code: string; message: string; details: Record<string, unknown> } } } {
  if (e instanceof AppError) return { status: e.status, body: { error: { code: e.code, message: e.message, details: e.details } } };
  if (e instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of e.issues) fields[issue.path.join('.') || '_'] = issue.message;
    return { status: 400, body: { error: { code: 'VALIDATION', message: 'Please check the highlighted fields.', details: { fields } } } };
  }
  return { status: 500, body: { error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.', details: {} } } };
}
