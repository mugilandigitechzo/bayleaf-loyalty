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
  const message = `Your Bay Leaf code is ${code}. It expires in 10 minutes. Never share it.`;
  switch (config.isTest ? 'test' : config.otpProvider) {
    case 'test':
      testOutbox.set(phoneE164, code);
      return;
    case 'console':
      console.log(`[otp:console] ${phoneE164} → ${code}   (development only — configure OTP_PROVIDER for production)`);
      return;
    case 'webhook': {
      if (!config.otpWebhookUrl) throw new AppError('OTP_NOT_CONFIGURED', 503, 'Sign-in codes are not available right now.');
      const res = await fetch(config.otpWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.otpWebhookToken ?? ''}` },
        body: JSON.stringify({ to: phoneE164, code, message }),
        signal: AbortSignal.timeout(10_000),
      }).catch(() => null);
      if (!res || !res.ok) throw new AppError('OTP_SEND_FAILED', 502, 'We couldn’t send the code. Check the number and try again.');
      return;
    }
    default:
      throw new AppError('OTP_NOT_CONFIGURED', 503, 'Sign-in codes are not available right now. Ask Bay Leaf staff to open your card for you.');
  }
}
