/** The average of a list of numbers; 0 for an empty one. */
export function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** A list with at least one item, so its first and last always exist. */
export type NonEmpty<T> = readonly [T, ...T[]];

/** Narrows a list to NonEmpty, so its first and last items read without a check. */
export const isNonEmpty = <T>(items: readonly T[]): items is NonEmpty<T> => items.length > 0;

/** The last item of a non-empty list; the fallback to the first only satisfies the types. */
export const lastOf = <T>(items: NonEmpty<T>): T => items[items.length - 1] ?? items[0];

/**
 * The item at an index the caller has already worked out. A wrong index is a
 * bug, so it fails here, loudly, instead of as an undefined somewhere later.
 */
export function itemAt<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new RangeError(`No item ${index} in a list of ${items.length}.`);
  return item;
}
