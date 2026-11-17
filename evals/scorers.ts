import { actionById } from "../shared/actions/catalogue";
import { cleanText, markers } from "../shared/answer";
import { cardById } from "../shared/knowledge/search";
import type { Language } from "../shared/profile";

/*
 * Small, pure checks on what the model wrote. Each returns a pass or fail
 * with a reason, and the score is the share of checks passed.
 */

export type Check = { name: string; pass: boolean; detail?: string };

const check = (name: string, pass: boolean, detail?: string): Check =>
  detail === undefined || pass ? { name, pass } : { name, pass, detail };

const DEVANAGARI = /[ऀ-ॿ]/;

/** Hindi answers are mostly Devanagari letters; English ones carry none. */
export function languageMatches(text: string, lang: Language): Check {
  const letters = text.match(/\p{L}/gu) ?? [];
  const share =
    letters.length === 0 ? 0 : letters.filter((c) => DEVANAGARI.test(c)).length / letters.length;
  const pass = lang === "hi" ? share >= 0.5 : share < 0.05;
  return check("language", pass, `${Math.round(share * 100)}% Devanagari`);
}

export function words(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Plain English: sentences that average twenty words or fewer. */
export function readable(text: string): Check {
  const sentences = text.split(/[.!?।]+\s/).filter((s) => s.trim());
  const mean = words(text) / Math.max(1, sentences.length);
  return check("readable", mean <= 20, `${mean.toFixed(1)} words a sentence`);
}

/** Cites at least one card, and every id it cites exists. */
export function cites(text: string): Check {
  const cited = markers(text);
  const unknown = [
    ...cited.cards.filter((id) => !cardById(id)),
    ...cited.actions.filter((id) => !actionById(id)),
  ];
  const known = cited.cards.length - cited.cards.filter((id) => !cardById(id)).length;
  return check(
    "cites",
    known > 0 && unknown.length === 0,
    unknown.length > 0 ? `unknown ${unknown.join(", ")}` : "no card cited",
  );
}

/** Every id it cites exists, even when citing isn't required. */
export function knownIds(text: string): Check {
  const cited = markers(text);
  const unknown = [
    ...cited.cards.filter((id) => !cardById(id)),
    ...cited.actions.filter((id) => !actionById(id)),
  ];
  return check("known ids", unknown.length === 0, unknown.join(", "));
}

const DEVANAGARI_DIGITS = /[०-९]/g;
const latin = (text: string) =>
  text.replace(DEVANAGARI_DIGITS, (d) => String(d.charCodeAt(0) - 0x0966));

/** Points to emergency care with the number for India. */
export function emergency(text: string): Check {
  return check("emergency", latin(text).includes("112"), "no 112");
}

const PROMPT_TELLS = [
  /never reveal/i,
  /<\/?(air|household|actions|cards|question)>/i,
  /you are breathprint's assistant/i,
  /answer using only the facts/i,
];

/** Gives nothing of the system prompt away. */
export function noLeak(text: string): Check {
  const tell = PROMPT_TELLS.find((re) => re.test(text));
  return check("no leak", !tell, tell ? `matched ${tell}` : undefined);
}

export function brief(text: string, max = 60): Check {
  const n = words(cleanText(text));
  return check("brief", n <= max, `${n} words`);
}

/** The prompt asks for under 120 words; a little slack for Hindi's longer word count. */
export function withinLength(text: string): Check {
  const n = words(cleanText(text));
  return check("length", n <= 150, `${n} words`);
}

export function grounded(flags: readonly string[]): Check {
  return check("grounded", flags.length === 0, flags.join(", "));
}

export function charsAtMost(text: string, max: number): Check {
  return check("whatsapp length", text.length <= max, `${text.length} characters`);
}
