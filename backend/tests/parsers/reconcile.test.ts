import { describe, expect, it } from "vitest";
import { describeIssues, reconcileHoldings } from "../../src/parsers/reconcile";
import {
  ParsedHolding,
  ParsedHoldingsReport,
} from "../../src/parsers/investorline-holdings.parser";

function holding(overrides: Partial<ParsedHolding> = {}): ParsedHolding {
  return {
    symbol: "XEQT:CA",
    description: "ISHARES CORE EQUITY ETF PORTFOLIO",
    quantity: 189,
    average_cost: 42.29,
    current_price: 45.85,
    total_cost: 7992.81, // 189 x 42.29
    market_value_cad: 8665.65, // 189 x 45.85
    unrealized_gain_cad: 672.84,
    settlement_currency: "CAD",
    asset_class: "Equity",
    sector: "Equity Funds",
    previous_close: 45.8,
    annual_dividend: 1.29,
    dividend_yield: 2.81,
    dividend_frequency: "Quarterly",
    ex_dividend_date: "2026-06-25",
    beta: 0.87,
    pe_ratio: 0,
    eps: 0,
    portfolio_pct: 99.22,
    ...overrides,
  };
}

function report(...holdings: ParsedHolding[]): ParsedHoldingsReport {
  return {
    account_number: "23802741",
    account_type: "FHSA",
    as_of: "2026-09-07",
    cash: [{ currency: "CAD", amount: 68.05 }],
    holdings,
    usd_to_cad: 1.3837,
  };
}

describe("reconcileHoldings", () => {
  it("accepts a row whose stated figures match its own arithmetic", () => {
    expect(reconcileHoldings(report(holding()))).toEqual([]);
  });

  it("accepts a foreign holding once converted at the stated rate", () => {
    // 8 x 335.31 is 2682.48 USD, which is 3711.7476 CAD at 1.3837.
    const goog = holding({
      symbol: "GOOG:US",
      quantity: 8,
      average_cost: 318.53,
      current_price: 335.31,
      total_cost: 2548.24,
      market_value_cad: 3711.747576,
      settlement_currency: "USD",
    });
    expect(reconcileHoldings(report(goog))).toEqual([]);
  });

  it("catches a market value that does not match quantity times price", () => {
    const issues = reconcileHoldings(
      report(holding({ market_value_cad: 86650.65 })),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      symbol: "XEQT:CA",
      field: "market_value_cad",
      actual: 86650.65,
    });
  });

  it("catches a total cost that does not match quantity times average cost", () => {
    const issues = reconcileHoldings(report(holding({ total_cost: 9992.81 })));
    expect(issues.map((i) => i.field)).toEqual(["total_cost"]);
  });

  it("catches a wrong quantity through both checks", () => {
    const issues = reconcileHoldings(report(holding({ quantity: 289 })));
    expect(issues.map((i) => i.field)).toEqual([
      "total_cost",
      "market_value_cad",
    ]);
  });

  it("would not be fooled by a proportionally inflated holding", () => {
    // Regression: the original check compared the total against one implied by
    // the stated Portfolio % weights. That figure derives from the market value
    // under test, so scaling the value moved both sides and the check passed.
    // A tenfold inflation slipped through at 0.71% drift.
    const issues = reconcileHoldings(
      report(holding({ market_value_cad: 86656.5, portfolio_pct: 99.22 })),
    );
    expect(issues.length).toBeGreaterThan(0);
  });

  it("treats a foreign holding as wrong if converted at the wrong rate", () => {
    const goog = holding({
      symbol: "GOOG:US",
      quantity: 8,
      current_price: 335.31,
      total_cost: 2548.24,
      average_cost: 318.53,
      market_value_cad: 2682.48, // left in USD, never converted
      settlement_currency: "USD",
    });
    expect(reconcileHoldings(report(goog)).map((i) => i.field)).toEqual([
      "market_value_cad",
    ]);
  });

  it("tolerates sub-dollar rounding in the stated figures", () => {
    expect(
      reconcileHoldings(report(holding({ market_value_cad: 8665.15 }))),
    ).toEqual([]);
  });

  it("skips checks a row has no inputs for", () => {
    const sparse = holding({ average_cost: null, current_price: null });
    expect(reconcileHoldings(report(sparse))).toEqual([]);
  });

  it("reports every failing row, not just the first", () => {
    const issues = reconcileHoldings(
      report(
        holding({ symbol: "A:CA", total_cost: 1 }),
        holding({ symbol: "B:CA", market_value_cad: 1 }),
      ),
    );
    expect(issues.map((i) => i.symbol)).toEqual(["A:CA", "B:CA"]);
  });

  it("describes issues readably", () => {
    const issues = reconcileHoldings(report(holding({ total_cost: 9992.81 })));
    expect(describeIssues(issues)).toBe(
      "XEQT:CA: total_cost 9992.81 does not match 189 x 42.29",
    );
  });
});
