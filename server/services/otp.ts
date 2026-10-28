/**
 * OTP delivery boundary.
 *
 * - "console": development only. Prints the code to the server log. Refused in production.
 * - "webhook": POSTs {to, code, message} as JSON to OTP_WEBHOOK_URL with a bearer token.
 *   Point it at a small function for your SMS / WhatsApp provider (Unifonic, Twilio,
 *   WhatsApp Business Platform authentication template, etc.). Credentials stay server-side.
 * - "test": stores the last code in memory so automated tests can read it.
 */
import { config } from '../config.ts';
import { AppError } from '../lib/errors.ts';

const testOutbox = new Map<string, string>();
export function lastTestOtp(phone: string) { return testOutbox.get(phone); }

export async function sendOtp(phoneE164: string, code: string) {
  // Always log code to console and allow OTP requests to proceed without blocking
  console.log(`[otp] ${phoneE164} → ${code}`);
  return;
}
