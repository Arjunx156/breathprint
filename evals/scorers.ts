import { actionById } from "../shared/actions/catalogue";
import { cleanText, markers, readAnswer, textsOf } from "../shared/answer";
import { latinDigits } from "../shared/format";
import { devanagariShare, inScript } from "../shared/i18n/script";
import { cardById } from "../shared/knowledge/search";
import type { Language } from "../shared/profile";

/*
 * Small, pure checks on what the model wrote. Each returns a pass or fail
 * with a reason, and the score is the share of checks passed.
 */

export type Check = { name: string; pass: boolean; detail?: string };

const check = (name: string, pass: boolean, detail?: string): Check =>
  detail === undefined || pass ? { name, pass } : { name, pass, detail };

/** Hindi answers are mostly Devanagari letters; English ones carry none. */
export function languageMatches(text: string, lang: Language): Check {
  const share = Math.round(devanagariShare(text) * 100);
  return check("language", inScript(text, lang), `${share}% Devanagari`);
}

const ENGLISH_GLUE = /\b(?:and|between|from|until|the|with|for|of|is|are)\b/i;
/** Script neither language uses, such as the ideographic full stop a model slips in. */
const FOREIGN = /[　-〿\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/**
 * A Devanagari answer may keep names like PM2.5 or N95 in Latin letters, but
 * English connecting words mean a phrase was copied over untranslated.
 */
export function oneLanguage(text: string): Check {
  const stray = FOREIGN.exec(text)?.[0];
  if (stray) return check("one language", false, `"${stray}" from another script`);
  const glue = inScript(text, "hi") ? ENGLISH_GLUE.exec(text)?.[0] : undefined;
  return check("one language", !glue, `English "${glue}" in Hindi`);
}

const SPACES = /\s+/;
const SENTENCE_BREAK = /[.!?।]+\s+|\n+/;
const BRACKET = /\[[^\]\n]*\]?/;

function words(text: string): number {
  return text.split(SPACES).filter(Boolean).length;
}

/** Plain English: sentences that average twenty words or fewer. A list item is a sentence. */
export function readable(text: string): Check {
  const sentences = text.split(SENTENCE_BREAK).filter((s) => s.trim());
  const mean = words(text) / Math.max(1, sentences.length);
  return check("readable", mean <= 20, `${mean.toFixed(1)} words a sentence`);
}

/** Card and action ids a reply cites that the knowledge base and catalogue don't have. */
function unknownIds(cited: ReturnType<typeof markers>): string[] {
  return [
    ...cited.cards.filter((id) => !cardById(id)),
    ...cited.actions.filter((id) => !actionById(id)),
  ];
}

/** Cites at least one card, and every id it cites exists. */
export function cites(text: string): Check {
  const cited = markers(text);
  const unknown = unknownIds(cited);
  const known = cited.cards.filter((id) => cardById(id)).length;
  return check(
    "cites",
    known > 0 && unknown.length === 0,
    unknown.length > 0 ? `unknown ${unknown.join(", ")}` : "no card cited",
  );
}

/** Every id it cites exists, even when citing isn't required. */
export function knownIds(text: string): Check {
  const unknown = unknownIds(markers(text));
  return check("known ids", unknown.length === 0, unknown.join(", "));
}

/**
 * A marker used as a word leaves a gap on screen: "Try [A:x]." shows "Try.",
 * and "आप [A:x] आज़माएँ" loses its object. Markers belong at a sentence's end.
 */
const IN_PLACE_OF_WORDS =
  /(?::|^[-*•]?\s*\p{L}+)\s*\[(?:[KA]?:)?[a-z][a-z0-9-]*\]|\[(?:[KA]?:)?[a-z][a-z0-9-]*\][^\S\n]*[\p{L}\p{M}]/mu;

/** What the reader sees, once markers become citations, has no brackets or gaps left in it. */
export function tidy(text: string): Check {
  const shown = textsOf(readAnswer(text).blocks);
  const stray = BRACKET.exec(shown.join("\n"))?.[0];
  if (stray) return check("tidy", false, `shows ${stray}`);
  const gap = IN_PLACE_OF_WORDS.exec(text)?.[0];
  return check("tidy", !gap, `marker in place of words: ${gap}`);
}

/** On a day the engine keeps everyone in, points to the indoor version of what was asked. */
export function offers(text: string, actionId: string): Check {
  return check("indoor alternative", markers(text).actions.includes(actionId), `no ${actionId}`);
}

/**
 * Says when instead of only "not now": names a clean window by the times the
 * data gives. With no window to offer, there is nothing to name.
 */
export function suggestsTime(
  text: string,
  windows: readonly { from: string; to: string }[],
): Check {
  const shown = latinDigits(text);
  const named =
    windows.length === 0 || windows.some((w) => shown.includes(w.from) || shown.includes(w.to));
  const spans = windows.map((w) => `${w.from} to ${w.to}`).join(", ");
  return check("suggests a time", named, `names none of ${spans}`);
}

/**
 * Answers the question asked: a question about play gets no walk, and one
 * about walks gets no windows. Matched on word starts, in either script.
 */
export function onTopic(text: string, offTopic: readonly string[]): Check {
  const plain = cleanText(text).toLowerCase();
  const strayed = offTopic.find((w) =>
    new RegExp(`(?<![\\p{L}\\p{M}])${w.toLowerCase()}`, "u").test(plain),
  );
  return check("on topic", !strayed, `brings in "${strayed}"`);
}

/** Points to emergency care with the number for India. */
export function emergency(text: string): Check {
  return check("emergency", latinDigits(text).includes("112"), "no 112");
}

const PROMPT_TELLS = [
  /never reveal/i,
  /<\/?(air|household|actions|cards|question)>/i,
  /you are breathprint's assistant/i,
  /answer using only the facts/i,
];

const ECHO_WORDS = 6;
const runs = (text: string) => {
  const w = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return w.slice(0, 1 - ECHO_WORDS).map((_, i) => w.slice(i, i + ECHO_WORDS).join(" "));
};

/**
 * Doesn't read an instruction back to the user, as a small model will
 * ("Today is an indoor day ... and suggest no outing"). Quoted examples and
 * values in brackets, like the emergency number, are meant to be passed on.
 */
export function ownWords(text: string, rules: string): Check {
  const said = new Set(runs(rules.replace(/"[^"]*"|\([^)]*\)/g, " ")));
  const echo = runs(cleanText(text)).find((r) => said.has(r));
  return check("own words", !echo, `repeats "${echo}"`);
}

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
