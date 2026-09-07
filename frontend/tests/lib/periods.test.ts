import { describe, expect, it } from "vitest";
import { getPeriodDates } from "../../src/lib/periods";

// Mid-month, so month arithmetic is not accidentally correct.
const SEP_2026 = new Date(2026, 8, 15);

describe("getPeriodDates", () => {
  it("covers the whole current month", () => {
    expect(getPeriodDates("this_month", SEP_2026)).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("covers the whole previous month", () => {
    expect(getPeriodDates("last_month", SEP_2026)).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
  });

  it("starts three months back, inclusive of the current month", () => {
    expect(getPeriodDates("last_3_months", SEP_2026)).toEqual({
      from: "2026-07-01",
    });
  });

  it("starts six months back, inclusive of the current month", () => {
    expect(getPeriodDates("last_6_months", SEP_2026)).toEqual({
      from: "2026-04-01",
    });
  });

  it("starts this year on January 1", () => {
    expect(getPeriodDates("this_year", SEP_2026)).toEqual({
      from: "2026-01-01",
    });
  });

  it("returns an open range for all time and unknown periods", () => {
    expect(getPeriodDates("all", SEP_2026)).toEqual({});
    expect(getPeriodDates("custom", SEP_2026)).toEqual({});
  });

  it("rolls back across the year boundary", () => {
    expect(getPeriodDates("last_month", new Date(2026, 0, 15))).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
    expect(getPeriodDates("last_6_months", new Date(2026, 1, 10))).toEqual({
      from: "2025-09-01",
    });
  });

  it("ends February on the right day in a leap year", () => {
    expect(getPeriodDates("this_month", new Date(2028, 1, 10))).toEqual({
      from: "2028-02-01",
      to: "2028-02-29",
    });
    expect(getPeriodDates("this_month", new Date(2026, 1, 10))).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });

  it("uses local calendar dates rather than UTC", () => {
    // Regression: toISOString() shifted local midnight back a day for
    // positive UTC offsets, so "this month" started in the previous month.
    const lateInTheDay = new Date(2026, 8, 1, 23, 30);
    expect(getPeriodDates("this_month", lateInTheDay).from).toBe("2026-09-01");
  });
});
