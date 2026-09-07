import { describe, expect, it } from "vitest";
import { getPageNumbers } from "../../src/components/ui/pagination";

// Pages are zero-indexed internally and rendered as +1.
describe("getPageNumbers", () => {
  it("lists every page when they all fit", () => {
    expect(getPageNumbers(0, 7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(getPageNumbers(0, 1)).toEqual([0]);
  });

  it("handles an empty result set", () => {
    expect(getPageNumbers(0, 0)).toEqual([]);
  });

  it("shows a leading run with one gap near the start", () => {
    expect(getPageNumbers(0, 20)).toEqual([0, 1, 2, 3, 4, "...", 19]);
    expect(getPageNumbers(3, 20)).toEqual([0, 1, 2, 3, 4, "...", 19]);
  });

  it("shows a trailing run with one gap near the end", () => {
    expect(getPageNumbers(19, 20)).toEqual([0, "...", 15, 16, 17, 18, 19]);
    expect(getPageNumbers(16, 20)).toEqual([0, "...", 15, 16, 17, 18, 19]);
  });

  it("brackets the current page with gaps on both sides in the middle", () => {
    expect(getPageNumbers(10, 20)).toEqual([0, "...", 9, 10, 11, "...", 19]);
  });

  it("always includes the first and last page", () => {
    for (const current of [0, 1, 5, 10, 15, 19]) {
      const pages = getPageNumbers(current, 20);
      expect(pages[0]).toBe(0);
      expect(pages[pages.length - 1]).toBe(19);
    }
  });

  it("never repeats a page number", () => {
    for (const current of [0, 3, 4, 10, 15, 16, 19]) {
      const numbers = getPageNumbers(current, 20).filter(
        (p): p is number => p !== "...",
      );
      expect(new Set(numbers).size).toBe(numbers.length);
    }
  });

  it("keeps page numbers in ascending order", () => {
    for (const current of [0, 4, 10, 15, 19]) {
      const numbers = getPageNumbers(current, 20).filter(
        (p): p is number => p !== "...",
      );
      expect([...numbers].sort((a, b) => a - b)).toEqual(numbers);
    }
  });
});
