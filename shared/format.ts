/** Rounds to two significant figures, so 3412 reads 3400 and 0.0734 reads 0.073. */
export function sig(n: number, digits = 2): number {
  if (n === 0 || !Number.isFinite(n)) return 0;
  return Number(n.toPrecision(digits));
}

/** A short human number for method lines: whole numbers above 10, one decimal below. */
export function short(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 10) return String(Math.round(n));
  if (abs >= 1) return n.toFixed(1);
  return sig(n, 2).toString();
}

/** Whole rupees grouped the Indian way, so 3500 reads 3,500 and 120000 reads 1,20,000. */
export const rupees = (n: number) => Math.round(Math.abs(n)).toLocaleString("en-IN");

/** HH:MM from a local YYYY-MM-DDTHH:MM time. */
export const clock = (time: string) => time.slice(11, 16);
