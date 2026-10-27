/**
 * Centralised copy. Every customer- and staff-facing string goes through t().
 * Arabic: the `ar` dictionary is intentionally empty until Bay Leaf supplies
 * verified translations (no machine-translated copy). With ENABLE_ARABIC=true the
 * app switches to RTL and falls back to English for any missing key.
 */
import { en } from './en.ts';
import { ar } from './ar.ts';

export type Lang = 'en' | 'ar';
export type Key = keyof typeof en;
const dicts: Record<Lang, Partial<Record<Key, string>>> = { en, ar };

let lang: Lang = 'en';

export function setLanguage(next: Lang) {
  lang = next;
  document.documentElement.lang = next;
  document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.style.setProperty('--dir-flip', next === 'ar' ? '-1' : '1');
  try { localStorage.setItem('bl_lang', next); } catch { /* storage unavailable */ }
}
export function getLanguage() { return lang; }

export function t(key: Key, vars: Record<string, string | number> = {}): string {
  let s = dicts[lang][key] ?? en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Simple English plural helper: plural(3, 'visit') -> "3 visits". */
export function plural(n: number, one: Key, many: Key, vars: Record<string, string | number> = {}) {
  return t(n === 1 ? one : many, { n, ...vars });
}

const locale = () => (lang === 'ar' ? 'ar-AE' : 'en-GB');
export function fmtDate(iso: string | Date, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Intl.DateTimeFormat(locale(), opts).format(new Date(iso));
}
export function fmtTime(iso: string | Date) {
  return new Intl.DateTimeFormat(locale(), { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}
export function fmtDateTime(iso: string | Date) {
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}
