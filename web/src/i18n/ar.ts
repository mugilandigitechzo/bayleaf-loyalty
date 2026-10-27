import type { en } from './en.ts';

/**
 * Arabic copy goes here, key by key, once Bay Leaf has verified translations.
 * Left empty on purpose: shipping unverified machine translation would undermine
 * a premium brand. Missing keys fall back to English.
 */
export const ar: Partial<Record<keyof typeof en, string>> = {};
