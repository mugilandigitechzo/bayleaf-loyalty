import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

/** Load a .env file if present (no third-party dotenv in this environment). */
function loadDotEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadDotEnv(path.join(root, process.env.NODE_ENV === 'test' ? '.env.test' : '.env'));

const env = process.env;
const isProd = env.NODE_ENV === 'production';
const isTest = env.NODE_ENV === 'test';

function required(name: string, devDefault?: string): string {
  const v = env[name];
  if (v) return v;
  if (!isProd && devDefault !== undefined) return devDefault;
  throw new Error(`Missing required environment variable ${name}`);
}

function key32(name: string, devSeed: string): Buffer {
  const v = env[name];
  if (v) {
    const b = Buffer.from(v, 'base64');
    if (b.length !== 32) throw new Error(`${name} must be 32 bytes, base64-encoded (openssl rand -base64 32)`);
    return b;
  }
  if (isProd) throw new Error(`Missing required environment variable ${name}`);
  // Deterministic dev/test key so local data survives restarts. Never used in production.
  return crypto.createHash('sha256').update('bayleaf-dev-only:' + devSeed).digest();
}

const appUrl = required('APP_URL', 'http://localhost:5173').replace(/\/$/, '');

export const config = {
  root,
  isProd,
  isTest,
  port: Number(env.PORT ?? 5173),
  host: env.HOST ?? '0.0.0.0',
  appUrl,
  appOrigin: new URL(appUrl).origin,
  trustProxy: env.TRUST_PROXY === 'true',
  databaseUrl: required('DATABASE_URL', isTest
    ? 'postgres://bayleaf:bayleaf_dev@localhost:5432/bayleaf_test'
    : 'postgres://bayleaf:bayleaf_dev@localhost:5432/bayleaf'),
  databaseSsl: (env.DATABASE_SSL ?? (isProd ? 'require' : 'false')) as 'false' | 'prefer' | 'require' | 'verify-full',
  databaseSslCaFile: env.DATABASE_SSL_CA_FILE,
  databasePoolSize: Number(env.DATABASE_POOL_SIZE ?? 10),
  /** AES-256-GCM key for tokens that must be shown again (QR, card link). */
  encryptionKey: key32('APP_ENCRYPTION_KEY', 'enc'),
  /** HMAC key for token lookup hashes, OTP hashes and session hashes. */
  hashKey: key32('APP_HASH_KEY', 'hash'),
  defaultPhoneRegion: (env.DEFAULT_PHONE_REGION ?? 'AE').toUpperCase(),
  otpProvider: env.OTP_PROVIDER ?? (isProd ? '' : 'console'),
  otpWebhookUrl: env.OTP_WEBHOOK_URL,
  otpWebhookToken: env.OTP_WEBHOOK_TOKEN,
  staffSessionHours: Number(env.STAFF_SESSION_HOURS ?? 12),
  customerSessionDays: Number(env.CUSTOMER_SESSION_DAYS ?? 60),
  enableArabic: env.ENABLE_ARABIC === 'true',
  logRequests: env.LOG_REQUESTS !== 'false' && !isTest,
};

export function assertProductionSafety() {
  if (!isProd) return;
  if (!config.appUrl.startsWith('https://')) throw new Error('APP_URL must use https:// in production');
  if (!config.otpProvider || config.otpProvider === 'console') {
    throw new Error('OTP_PROVIDER must be configured in production (the console provider only logs codes)');
  }
  if (config.databaseSsl === 'false') {
    console.warn('[bayleaf] DATABASE_SSL=false in production. Only acceptable when the database is on a private network or the same host.');
  }
}
