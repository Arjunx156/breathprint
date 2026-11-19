import { describe, expect, test } from "bun:test";
import { isNonEmpty, itemAt, lastOf } from "./list";

describe("lists", () => {
  test("a non-empty list knows its last item, even when it has only one", () => {
    const one = [7];
    const three = [1, 2, 3];
    expect(isNonEmpty([])).toBe(false);
    if (!isNonEmpty(one) || !isNonEmpty(three)) throw new Error("both hold items");
    expect(lastOf(one)).toBe(7);
    expect(lastOf(three)).toBe(3);
  });

  test("a checked index gives the item, and a wrong one fails where it happened", () => {
    expect(itemAt(["a", "b"], 1)).toBe("b");
    expect(() => itemAt(["a", "b"], 2)).toThrow(RangeError);
    expect(() => itemAt([], 0)).toThrow("No item 0 in a list of 0.");
  });
});
