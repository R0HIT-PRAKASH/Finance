import { ParsedHoldingsReport } from "./investorline-holdings.parser";

export type ReconciliationIssue = {
  symbol: string;
  field: "total_cost" | "market_value_cad";
  actual: number;
  expected: number;
  detail: string;
};

/** Absolute floor so sub-dollar rounding never trips the relative check. */
const TOLERANCE_RATIO = 0.005;
const TOLERANCE_FLOOR = 1;

function differs(actual: number, expected: number): boolean {
  return (
    Math.abs(actual - expected) >
    Math.max(TOLERANCE_FLOOR, Math.abs(expected) * TOLERANCE_RATIO)
  );
}

/**
 * Checks each holding against arithmetic the statement asserts about itself:
 * quantity x average cost should be the stated total cost, and quantity x price
 * (converted, for a foreign holding) should be the stated market value.
 *
 * Deliberately does not compare a total against one implied by the stated
 * Portfolio % weights. That figure is derived from the market values being
 * checked, so a wrong market value moves both sides together and the check
 * passes regardless.
 */
export function reconcileHoldings(
  report: ParsedHoldingsReport,
): ReconciliationIssue[] {
  const issues: ReconciliationIssue[] = [];

  for (const h of report.holdings) {
    if (h.average_cost !== null && h.total_cost !== null) {
      const expected = h.quantity * h.average_cost;
      if (differs(h.total_cost, expected)) {
        issues.push({
          symbol: h.symbol,
          field: "total_cost",
          actual: h.total_cost,
          expected,
          detail: `${h.quantity} x ${h.average_cost}`,
        });
      }
    }

    if (h.current_price !== null) {
      // Cost and price are in the settlement currency; market value is CAD.
      const fx = h.settlement_currency === "CAD" ? 1 : (report.usd_to_cad ?? 1);
      const expected = h.quantity * h.current_price * fx;
      if (differs(h.market_value_cad, expected)) {
        issues.push({
          symbol: h.symbol,
          field: "market_value_cad",
          actual: h.market_value_cad,
          expected,
          detail: `${h.quantity} x ${h.current_price}${fx === 1 ? "" : ` x ${fx}`}`,
        });
      }
    }
  }

  return issues;
}

export function describeIssues(issues: ReconciliationIssue[]): string {
  return issues
    .map((i) => `${i.symbol}: ${i.field} ${i.actual} does not match ${i.detail}`)
    .join("; ");
}
