/** Calendar date (YYYY-MM-DD) for an instant in an IANA time zone. */
export function businessDate(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function isValidTimeZone(tz: string): boolean {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; }
}

/**
 * The current time. Tests can shift it (to prove month boundaries and long
 * inactivity never reset progress) via setClockOffset; production never does.
 */
let offsetMs = 0;
export function now(): Date { return new Date(Date.now() + offsetMs); }
export function setClockOffset(ms: number) {
  if (process.env.NODE_ENV === 'production') throw new Error('Clock offset is test-only');
  offsetMs = ms;
}
