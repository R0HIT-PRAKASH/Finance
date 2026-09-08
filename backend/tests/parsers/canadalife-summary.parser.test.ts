import { describe, expect, it } from "vitest";
import { parseCanadaLifeSummary } from "../../src/parsers/canadalife-summary.parser";

/** Copied verbatim from pdftotext -layout on a real statement. */
const RRSP = `Activity reports
REGISTERED RETIREMENT SAVINGS PLAN
RRSP

Start date: SEP 8, 2025
End date: SEP 8, 2026

Summary of activity

       Value of this plan on    $2,435.95
       September 7, 2025

       Contributions you made   $3,497.16
       Change in the market value $900.10
       of your investments

       Value of this plan on    $6,833.21
       September 7, 2026
`;

/**
 * Verbatim from the real DPSP statement. The employer wording wraps, putting
 * the amount before the word "company" rather than after the whole phrase. A
 * fixture built by editing the RRSP text does not reproduce that, which is how
 * the original regex passed its test and still failed on the actual file.
 */
const DPSP = `Activity reports
DEFERRED PROFIT SHARING PLAN
DPSP

Summary of activity

       Value of this plan on   $2,435.95
       September 7, 2025

       Contributions made by the $3,497.16
       company

       Change in the market value $900.10
       of your investments

       Value of this plan on   $6,833.21
       September 7, 2026
`;

describe("parseCanadaLifeSummary", () => {
  it("reads the four figures and the period", () => {
    expect(parseCanadaLifeSummary(RRSP)).toEqual({
      plan: "RRSP",
      period_start: "2025-09-07",
      period_end: "2026-09-07",
      opening_value_cad: 2435.95,
      contributions_cad: 3497.16,
      market_change_cad: 900.1,
      closing_value_cad: 6833.21,
      contributor: "member",
    });
  });

  it("tells the two plans apart by who contributed", () => {
    // The plans hold identical funds in identical amounts; the only thing
    // separating them is this wording.
    expect(parseCanadaLifeSummary(RRSP).contributor).toBe("member");
    expect(parseCanadaLifeSummary(DPSP).contributor).toBe("employer");
    expect(parseCanadaLifeSummary(DPSP).plan).toBe("DPSP");
  });

  it("refuses a summary whose figures do not add up", () => {
    // Opening plus contributions plus change must equal closing, so a
    // misextracted number cannot pass silently.
    const broken = RRSP.replace("$900.10", "$1,900.10");
    expect(() => parseCanadaLifeSummary(broken)).toThrow(/does not reconcile/);
  });

  it("throws when the report is missing a plan value", () => {
    const truncated = RRSP.split("Contributions")[0];
    expect(() => parseCanadaLifeSummary(truncated)).toThrow(
      /both plan values/,
    );
  });

  it("throws when contributions are absent", () => {
    const noContributions = RRSP.replace(
      "Contributions you made   $3,497.16",
      "",
    );
    expect(() => parseCanadaLifeSummary(noContributions)).toThrow(
      /contributions or market change/,
    );
  });
});
