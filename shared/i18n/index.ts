import type { Language, Member } from "../profile";
import { en } from "./en";
import { hi } from "./hi";

export type MessageKey = keyof typeof en;
export type Vars = Readonly<Record<string, string | number>>;

const MESSAGES: Record<Language, Readonly<Record<MessageKey, string>>> = { en, hi };

/** Whether a key built at run time names a real message, so `t` can take it. */
export function isMessageKey(key: string): key is MessageKey {
  return Object.hasOwn(en, key);
}

/**
 * The string for `key` in `lang`, with {placeholders} filled from `vars`. The
 * browser loads Hindi on demand, so for that moment English stands in.
 */
export function t(lang: Language, key: MessageKey, vars: Vars = {}): string {
  const text: string | undefined = MESSAGES[lang][key];
  return (text ?? en[key]).replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/** For keys built at run time, such as `aqi.${scale}.${category}`: a key with no string reads as itself. */
export function tx(lang: Language, key: string, vars?: Vars): string {
  return isMessageKey(key) ? t(lang, key, vars) : key;
}

/** Placeholder names a string expects, for checking translations agree. */
export function placeholders(lang: Language, key: MessageKey): string[] {
  return [...MESSAGES[lang][key].matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string).sort();
}

/** "Kabir, Anya and Dadi", or "the whole family" when everyone is named. */
export function names(
  lang: Language,
  people: readonly Member[],
  household: readonly Member[],
): string {
  if (people.length > 1 && people.length === household.length) return t(lang, "who.family");
  // The person who set the app up is "you"; anyone else unnamed is named by age.
  const labels = people.map(
    (m) => m.name ?? (m.id === "me" ? t(lang, "who.you") : t(lang, `group.${m.group}`)),
  );
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} ${t(lang, "list.and")} ${labels.at(-1)}`;
}
