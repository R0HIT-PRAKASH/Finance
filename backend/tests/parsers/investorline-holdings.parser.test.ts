import { describe, expect, it } from "vitest";
import { parseInvestorlineHoldings } from "../../src/parsers/investorline-holdings.parser";

const HOLDING_HEADER =
  "Symbol,Security Description,Quantity,Average cost, ,Current price, ,Total cost, ,Market Value, ,Unrealized gain/loss $, ,Unrealized gain/loss %,Asset Class,Sector,Settlement Currency,Bid lots,Bid,Ask,Ask lots,Chg $,Chg %,Open,Previous close,Volume,Indicated annual Dividend,Annualized Income,Dividend yield %,EX-dividend date,Dividend frequency,Beta,P/E ratio,EPS,Portfolio %";

// A USD holding: cost columns in USD, market value already converted to CAD.
const GOOG =
  "GOOG:US,ALPHABET INC. (C),8,318.53,,335.31,,2548.24,,3711.747576,,206.388616,,,Equity,Communication Services,USD,1000,335.6 U,335.75 U,3480,-3.55,-1.0476,339.18 U,339.08 U,12700476,0.88,7.04,0.26,2026-09-04,Quarterly,1.43,16.86,19.89,2.88";

// A CAD holding with no dividend data at all.
const SNDK =
  "SNDK:CA,SANDISK CDR (CAD HEDGED),85,52.74706,,42.24,,4483.5001,,3590.4,,-893.1001,,,Equity,Information Tech.,CAD,86,42.18 C,42.25 C,10,4.45,11.7756,38.45 C,37.79 C,2001215,,,0,,,2.69,0,0,2.78";

function report(...rows: string[]) {
  return [
    "Portfolio report for INDIVIDUAL account # 23904403 as of Mon Sep 07 2026 00:22:31 GMT-0700 (Pacific Daylight Time)",
    "",
    "Cash Details",
    "Currency,Account Type,Cash,Balance after trades",
    "CAD,CASH,246.61,246.61",
    "USD,CASH,2.91,2.91",
    "Total(in CAD),,250.64,250.64",
    "Total(in USD),,181.14,181.14",
    "",
    "Holding Details",
    HOLDING_HEADER,
    ...rows,
    "",
    "Exchange Rate: 1 CAD = 0.7227USD  1 USD = 1.3837CAD",
  ].join("\n");
}

describe("parseInvestorlineHoldings", () => {
  it("identifies the account and date from the header", () => {
    const r = parseInvestorlineHoldings(report(GOOG));
    expect(r.account_number).toBe("23904403");
    expect(r.account_type).toBe("INDIVIDUAL");
    expect(r.as_of).toBe("2026-09-07");
  });

  it("reads the exchange rate from the footer", () => {
    expect(parseInvestorlineHoldings(report(GOOG)).usd_to_cad).toBe(1.3837);
  });

  it("reads cash per currency and ignores the converted totals", () => {
    // Total(in CAD) and Total(in USD) restate the same money and would double count.
    expect(parseInvestorlineHoldings(report(GOOG)).cash).toEqual([
      { currency: "CAD", amount: 246.61 },
      { currency: "USD", amount: 2.91 },
    ]);
  });

  it("keeps cost in the settlement currency while market value is CAD", () => {
    const [h] = parseInvestorlineHoldings(report(GOOG)).holdings;
    expect(h.settlement_currency).toBe("USD");
    expect(h.total_cost).toBe(2548.24); // USD
    expect(h.market_value_cad).toBe(3711.747576); // already CAD
    expect(h.quantity).toBe(8);
  });

  it("does not derive market value from quantity times price", () => {
    // 8 x 335.31 is 2682.48 USD; the file states 3711.75 because it is CAD.
    const [h] = parseInvestorlineHoldings(report(GOOG)).holdings;
    expect(h.market_value_cad).not.toBeCloseTo(h.quantity * h.current_price!, 2);
  });

  it("reads the security metadata columns", () => {
    const [h] = parseInvestorlineHoldings(report(GOOG)).holdings;
    expect(h).toMatchObject({
      asset_class: "Equity",
      sector: "Communication Services",
      previous_close: 339.08,
      annual_dividend: 0.88,
      dividend_yield: 0.26,
      ex_dividend_date: "2026-09-04",
      dividend_frequency: "Quarterly",
      beta: 1.43,
      pe_ratio: 16.86,
      eps: 19.89,
      portfolio_pct: 2.88,
    });
  });

  it("leaves missing dividend fields null rather than zero", () => {
    const [h] = parseInvestorlineHoldings(report(SNDK)).holdings;
    expect(h.annual_dividend).toBeNull();
    expect(h.dividend_frequency).toBeNull();
    expect(h.ex_dividend_date).toBeNull();
    expect(h.beta).toBe(2.69);
  });

  it("strips the currency suffix from quote columns", () => {
    const [h] = parseInvestorlineHoldings(report(SNDK)).holdings;
    expect(h.previous_close).toBe(37.79); // "37.79 C" in the file
  });

  it("reads every holding row", () => {
    const r = parseInvestorlineHoldings(report(GOOG, SNDK));
    expect(r.holdings.map((h) => h.symbol)).toEqual(["GOOG:US", "SNDK:CA"]);
  });

  it("rejects a file that is not a portfolio report", () => {
    expect(() => parseInvestorlineHoldings("Date,Description,Amount\n")).toThrow(
      /Not an InvestorLine portfolio report/,
    );
  });
});
