import type { Language } from "../profile";

const DEVANAGARI = /[ऀ-ॿ]/;

/** The share of letters written in Devanagari: near 1 for Hindi, 0 for English. */
export function devanagariShare(text: string): number {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return 0;
  return letters.filter((c) => DEVANAGARI.test(c)).length / letters.length;
}

/**
 * Whether text is in the script its language is shown in. Hindi may keep
 * names like PM2.5 or N95 in Latin letters, so half Devanagari is enough.
 */
export function inScript(text: string, lang: Language): boolean {
  const share = devanagariShare(text);
  return lang === "hi" ? share >= 0.5 : share < 0.05;
}
