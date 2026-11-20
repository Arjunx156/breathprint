/** Rounds to two significant figures, so 3412 reads 3400 and 0.0734 reads 0.073. */
export function sig(n: number, digits = 2): number {
  if (n === 0 || !Number.isFinite(n)) return 0;
  return Number(n.toPrecision(digits));
}

/** A short human number: whole and grouped above 10, so 1176 reads 1,176; one decimal below. */
export function short(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 10) return Math.round(n).toLocaleString("en-IN");
  if (abs >= 1) return n.toFixed(1);
  return sig(n, 2).toString();
}

/** Whole rupees grouped the Indian way, so 3500 reads 3,500 and 120000 reads 1,20,000. */
export const rupees = (n: number) => Math.round(Math.abs(n)).toLocaleString("en-IN");

const DEVANAGARI_DIGITS = /[०-९]/g;
const DEVANAGARI_ZERO = "०".charCodeAt(0);

/** Hindi text may write ४२ for 42; this reads every digit the Latin way. */
export const latinDigits = (text: string) =>
  text.replace(DEVANAGARI_DIGITS, (d) => String(d.charCodeAt(0) - DEVANAGARI_ZERO));

/** HH:MM from a local YYYY-MM-DDTHH:MM time. */
export const clock = (time: string) => time.slice(11, 16);

/** The hour of day, 0 to 23, from a YYYY-MM-DDTHH:MM time. */
export const hourOf = (time: string) => Number(time.slice(11, 13));

/** The YYYY-MM-DD date from a YYYY-MM-DDTHH:MM time. */
export const dayOf = (time: string) => time.slice(0, 10);

/** Rounds to one decimal place, the precision every concentration is shown and stored at. */
export const oneDecimal = (n: number) => Math.round(n * 10) / 10;
