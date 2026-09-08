import { describe, expect, it } from "vitest";
import {
  simpleReturn,
  timeWeightedReturn,
  xirr,
} from "../../src/investments/returns";

describe("timeWeightedReturn", () => {
  it("measures plain growth when there are no flows", () => {
    const twr = timeWeightedReturn([
      { date: "2026-01-01", value: 100, flow: 0 },
      { date: "2026-01-02", value: 110, flow: 0 },
    ]);
    expect(twr).toBeCloseTo(0.1, 10);
  });

  it("does not count a deposit as a gain", () => {
    // The whole point of TWR: value doubled, but only because money was added.
    const twr = timeWeightedReturn([
      { date: "2026-01-01", value: 100, flow: 0 },
      { date: "2026-01-02", value: 200, flow: 100 },
    ]);
    expect(twr).toBeCloseTo(0, 10);
  });

  it("is unaffected by the size of a deposit", () => {
    const small = timeWeightedReturn([
      { date: "2026-01-01", value: 100, flow: 0 },
      { date: "2026-01-02", value: 210, flow: 100 },
    ]);
    const large = timeWeightedReturn([
      { date: "2026-01-01", value: 100, flow: 0 },
      { date: "2026-01-02", value: 10_010, flow: 9900 },
    ]);
    expect(small).toBeCloseTo(0.1, 10);
    expect(large).toBeCloseTo(0.1, 10);
  });

  it("chains sub-period returns geometrically", () => {
    // +10% then +10% compounds to 21%, not 20%.
    const twr = timeWeightedReturn([
      { date: "2026-01-01", value: 100, flow: 0 },
      { date: "2026-01-02", value: 110, flow: 0 },
      { date: "2026-01-03", value: 121, flow: 0 },
    ]);
    expect(twr).toBeCloseTo(0.21, 10);
  });

  it("handles losses and withdrawals", () => {
    const twr = timeWeightedReturn([
      { date: "2026-01-01", value: 100, flow: 0 },
      { date: "2026-01-02", value: 40, flow: -50 },
    ]);
    expect(twr).toBeCloseTo(-0.1, 10);
  });

  it("skips periods that open with no capital at risk", () => {
    const twr = timeWeightedReturn([
      { date: "2026-01-01", value: 0, flow: 0 },
      { date: "2026-01-02", value: 100, flow: 100 },
      { date: "2026-01-03", value: 110, flow: 0 },
    ]);
    expect(twr).toBeCloseTo(0.1, 10);
  });

  it("returns null without at least two valuations", () => {
    expect(timeWeightedReturn([])).toBeNull();
    expect(
      timeWeightedReturn([{ date: "2026-01-01", value: 100, flow: 0 }]),
    ).toBeNull();
  });
});

describe("xirr", () => {
  it("solves a simple one year doubling", () => {
    const rate = xirr([
      { date: "2026-01-01", amount: -100 },
      { date: "2027-01-01", amount: 200 },
    ]);
    expect(rate).toBeCloseTo(1.0, 3);
  });

  it("annualises a partial year", () => {
    // +10% over roughly half a year annualises to about 21%.
    const rate = xirr([
      { date: "2026-01-01", amount: -100 },
      { date: "2026-07-02", amount: 110 },
    ]);
    expect(rate).toBeCloseTo(0.21, 2);
  });

  it("reflects the timing of deposits, unlike TWR", () => {
    const early = xirr([
      { date: "2026-01-01", amount: -100 },
      { date: "2026-02-01", amount: -100 },
      { date: "2027-01-01", amount: 220 },
    ]);
    const late = xirr([
      { date: "2026-01-01", amount: -100 },
      { date: "2026-11-01", amount: -100 },
      { date: "2027-01-01", amount: 220 },
    ]);
    expect(early).not.toBeCloseTo(late!, 3);
    // The same ending value off later money is the better rate.
    expect(late!).toBeGreaterThan(early!);
  });

  it("handles a loss", () => {
    const rate = xirr([
      { date: "2026-01-01", amount: -100 },
      { date: "2027-01-01", amount: 80 },
    ]);
    expect(rate).toBeCloseTo(-0.2, 3);
  });

  it("returns null when flows never change sign", () => {
    expect(
      xirr([
        { date: "2026-01-01", amount: -100 },
        { date: "2027-01-01", amount: -50 },
      ]),
    ).toBeNull();
  });

  it("returns null with fewer than two flows", () => {
    expect(xirr([{ date: "2026-01-01", amount: -100 }])).toBeNull();
  });
});

describe("simpleReturn", () => {
  it("computes growth between two prices", () => {
    expect(simpleReturn(167.08, 189.54)).toBeCloseTo(0.13443, 4);
  });

  it("returns null when there is no starting price", () => {
    expect(simpleReturn(0, 100)).toBeNull();
  });
});
