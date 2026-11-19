import { latinDigits } from "../../shared/format";

/** Units that make a number a claim worth checking, in English and Hindi. */
const UNIT =
  "%|percent|µg|μg|ug|mcg|mg|kg|g|grams?|kilograms?|tonnes?|cigarettes?|m³|cubic met(?:re|er)s?|प्रतिशत|किलो|ग्राम|सिगरेट";
const PREFIX = String.raw`₹|rs\.?\s?|inr\s?|aqi\s(?:of\s|is\s)?|एक्यूआई\s`;
const FIGURE = new RegExp(
  String.raw`(${PREFIX})?(\d[\d,]*(?:\.\d+)?)(\s?(?:${UNIT})(?![\p{L}]))?`,
  "giu",
);

export type Figure = { text: string; value: number };

/** Numbers that come with a unit or a currency, which are the ones a family would act on. */
export function figures(text: string): Figure[] {
  const found: Figure[] = [];
  for (const m of latinDigits(text).matchAll(FIGURE)) {
    const [whole, prefix, digits, unit] = m;
    if (!digits || (!prefix && !unit)) continue;
    found.push({ text: whole.trim(), value: Number(digits.replaceAll(",", "")) });
  }
  return found;
}

/**
 * Close enough to count as the same figure: a model may round 323 to "about
 * 320" or 9.7 to 10, but 99% is not 95%.
 */
const matches = (value: number, known: number) =>
  Math.abs(value - known) <= Math.max(0.5, Math.abs(known) * 0.02);

/**
 * Figures in a reply that appear nowhere in what the model was given. The
 * engine is the only thing allowed to calculate, so each of these is either
 * an invention or a sum the model did itself.
 */
export function ungrounded(text: string, allowed: readonly number[]): string[] {
  return figures(text)
    .filter((f) => !allowed.some((known) => matches(f.value, known)))
    .map((f) => f.text);
}
