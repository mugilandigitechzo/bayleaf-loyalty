/**
 * Mobile number validation and E.164 normalisation.
 *
 * libphonenumber-js could not be installed in the build environment, so this
 * carries explicit mobile rules for the GCC markets Bay Leaf serves (plus India,
 * a common origin for Gulf residents). Numbers from other countries are accepted
 * only in full international form (+CC...) with a plausible length.
 */

interface Region {
  cc: string;           // country calling code
  name: string;
  nsnLength: number[];  // national significant number lengths for mobiles
  mobile: RegExp;       // applied to the NSN (no trunk prefix)
  trunk?: string;       // national trunk prefix to strip, e.g. "0"
}

export const REGIONS: Record<string, Region> = {
  AE: { cc: '971', name: 'United Arab Emirates', nsnLength: [9], mobile: /^5[024568]\d{7}$/, trunk: '0' },
  SA: { cc: '966', name: 'Saudi Arabia', nsnLength: [9], mobile: /^5\d{8}$/, trunk: '0' },
  QA: { cc: '974', name: 'Qatar', nsnLength: [8], mobile: /^[3567]\d{7}$/ },
  KW: { cc: '965', name: 'Kuwait', nsnLength: [8], mobile: /^[4569]\d{7}$/ },
  BH: { cc: '973', name: 'Bahrain', nsnLength: [8], mobile: /^(3\d|6[3669])\d{6}$/ },
  OM: { cc: '968', name: 'Oman', nsnLength: [8], mobile: /^[79]\d{7}$/ },
  IN: { cc: '91', name: 'India', nsnLength: [10], mobile: /^[6-9]\d{9}$/, trunk: '0' },
};

const BY_CC = Object.entries(REGIONS).sort((a, b) => b[1].cc.length - a[1].cc.length);

export type PhoneResult = { ok: true; e164: string; region: string | null } | { ok: false; reason: 'empty' | 'invalid' | 'not_mobile' };

export function normalisePhone(input: string, defaultRegion = 'AE'): PhoneResult {
  if (!input || !input.trim()) return { ok: false, reason: 'empty' };
  // Arabic-Indic and Eastern Arabic-Indic digits -> ASCII (customers may type either).
  let s = input.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
               .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
               .trim();
  if (!/^[+\d\s().-]+$/.test(s)) return { ok: false, reason: 'invalid' };
  const international = s.startsWith('+') || s.startsWith('00');
  let digits = s.replace(/\D/g, '');
  if (s.startsWith('00')) digits = digits.slice(2);

  if (international) {
    for (const [code, r] of BY_CC) {
      if (digits.startsWith(r.cc)) {
        let nsn = digits.slice(r.cc.length);
        if (r.trunk && nsn.startsWith(r.trunk) && !r.nsnLength.includes(nsn.length)) nsn = nsn.slice(r.trunk.length);
        return checkRegion(code, r, nsn);
      }
    }
    if (digits.length < 8 || digits.length > 15 || digits.startsWith('0')) return { ok: false, reason: 'invalid' };
    return { ok: true, e164: '+' + digits, region: null };
  }

  const r = REGIONS[defaultRegion];
  if (!r) return { ok: false, reason: 'invalid' };
  let nsn = digits;
  if (r.trunk && nsn.startsWith(r.trunk)) nsn = nsn.slice(r.trunk.length);
  // People sometimes type the country code without "+" (e.g. 9715...).
  if (!r.nsnLength.includes(nsn.length) && nsn.startsWith(r.cc)) nsn = nsn.slice(r.cc.length);
  return checkRegion(defaultRegion, r, nsn);
}

function checkRegion(code: string, r: Region, nsn: string): PhoneResult {
  if (!r.nsnLength.includes(nsn.length)) return { ok: false, reason: 'invalid' };
  if (!r.mobile.test(nsn)) return { ok: false, reason: 'not_mobile' };
  return { ok: true, e164: '+' + r.cc + nsn, region: code };
}

/** "+971501234567" -> "•••• 4567" for staff screens. */
export function maskPhone(e164: string): string {
  return '•••• ' + e164.slice(-4);
}

/** Readable international format, e.g. "+971 50 123 4567". */
export function formatPhone(e164: string): string {
  for (const [, r] of BY_CC) {
    if (e164.startsWith('+' + r.cc)) {
      const n = e164.slice(1 + r.cc.length);
      const groups = n.length === 9 ? [n.slice(0, 2), n.slice(2, 5), n.slice(5)]
        : n.length === 8 ? [n.slice(0, 4), n.slice(4)]
        : n.length === 10 ? [n.slice(0, 5), n.slice(5)] : [n];
      return `+${r.cc} ${groups.join(' ')}`;
    }
  }
  return e164;
}
