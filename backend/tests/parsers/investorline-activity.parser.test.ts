import { describe, expect, it } from "vitest";
import { parseInvestorlineActivity } from "../../src/parsers/investorline-activity.parser";

const PREAMBLE = `Transaction Type=ALL,Product Type=All,Symbol=,From=2026-01-01,To=2026-09-07,,,,,,,,
Transaction Date,Settlement Date,Account name,Account type,Account number,Activity Description,Description,Symbol,Quantity,Price,Price Currency,Total Amount,Total Currency
----------------,---------------,------------,------------,--------------,--------------------,-----------,------,--------,-----,--------------,------------,--------------`;

function parse(...rows: string[]) {
  return parseInvestorlineActivity([PREAMBLE, ...rows].join("\n"));
}

describe("parseInvestorlineActivity", () => {
  it("skips the preamble, header and dashed rule", () => {
    expect(parseInvestorlineActivity(PREAMBLE)).toEqual([]);
  });

  it("reads a buy with its account number and settlement date", () => {
    const [a] = parse(
      "2026-08-17,2026-08-18,ROHIT PRAKASH,Individual,23904403,Buy,BMO EQUAL WEIGHT BKS INDX ETF,ZEB,65,78.77,CAD,-5130,CAD",
    );
    expect(a).toMatchObject({
      date: "2026-08-17",
      settlement_date: "2026-08-18",
      account_number: "23904403",
      activity_type: "buy",
      security: "ZEB",
      quantity: 65,
      price: 78.77,
      amount: -5130,
      currency: "CAD",
    });
  });

  it("keeps sells negative in quantity and positive in cash", () => {
    const [a] = parse(
      "2026-06-22,2026-06-23,ROHIT PRAKASH,Individual,23904403,Sell,ISHARES MSCI EUROPE IMI INDEX,XEU,-500,41.46,CAD,20721.71,CAD",
    );
    expect(a.activity_type).toBe("sell");
    expect(a.quantity).toBe(-500);
    expect(a.amount).toBe(20721.71);
  });

  it('treats "Interest" on a security as a distribution, not interest', () => {
    // BMO labels ETF distributions "Interest"; only a row with no symbol is
    // genuine cash interest.
    const [dist] = parse(
      "2026-09-02,2026-09-02,ROHIT PRAKASH,TFSA,22883310,Interest,BMO EQUAL WEIGHT BKS INDX ETF,ZEB,400,0,,59.2,CAD",
    );
    expect(dist.activity_type).toBe("distribution");
    expect(dist.security).toBe("ZEB");
  });

  it("classifies the remaining activity types", () => {
    const rows = parse(
      "2026-07-28,2026-07-28,ROHIT PRAKASH,TFSA,22883310,Dividend,MICRON TECHNOLOGY CIBC CDN DEP,MU,240,0,,1.56,CAD",
      "2026-07-28,2026-07-28,ROHIT PRAKASH,TFSA,22883310,Non resident tax,MICRON TECHNOLOGY CIBC CDN DEP,MU,240,0,,-0.23,CAD",
      "2026-08-14,2026-08-14,ROHIT PRAKASH,Individual,23904403,Deposit ,DEPOSIT,,0,0,,5300,CAD",
      "2026-06-25,2026-06-25,ROHIT PRAKASH,RRSP,21867136,Contribution,RRSP CONTRIBUTION FROM 2390440,,0,0,,7362,CAD",
      "2026-04-14,2026-04-14,ROHIT PRAKASH,Individual,23904403,Transfer of Funds ,BOMIS/SIDM BR 3677,,0,0,,-7994.98,CAD",
      "2026-05-04,2026-05-04,ROHIT PRAKASH,Individual,23904403,Foreign Exchange,SELL USD @ 1.3365 (AUTO FX,,0,0,,344.11,CAD",
    );
    expect(rows.map((r) => r.activity_type)).toEqual([
      "dividend",
      "withholding_tax",
      "deposit",
      "contribution",
      "transfer",
      "fx",
    ]);
  });

  it("tolerates the trailing space BMO leaves on some activity labels", () => {
    const [a] = parse(
      "2026-08-14,2026-08-14,ROHIT PRAKASH,Individual,23904403,Deposit ,DEPOSIT,,0,0,,5300,CAD",
    );
    expect(a.activity_type).toBe("deposit");
    expect(a.raw_activity).toBe("Deposit");
  });

  it("leaves security and price null on cash-only rows", () => {
    const [a] = parse(
      "2026-08-14,2026-08-14,ROHIT PRAKASH,Individual,23904403,Deposit ,DEPOSIT,,0,0,,5300,CAD",
    );
    expect(a.security).toBeNull();
    expect(a.price_currency).toBeNull();
    expect(a.amount).toBe(5300);
  });

  it("keeps a zero-cash fill, since the order total sits on a sibling row", () => {
    // A single order split across fills: BMO puts the whole cash amount on one
    // row and 0 on the others. Dropping the zero row would lose its units.
    const rows = parse(
      "2026-08-04,2026-08-05,ROHIT PRAKASH,Individual,23904403,Buy,ISHARES CORE EQTY ETF PORT UNI,XEQT,100,45.91,CAD,0,CAD",
      "2026-08-04,2026-08-05,ROHIT PRAKASH,Individual,23904403,Buy,ISHARES CORE EQTY ETF PORT UNI,XEQT,5,45.91,CAD,-4820.05,CAD",
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.quantity)).toEqual([100, 5]);
    expect(rows.reduce((t, r) => t + r.amount, 0)).toBe(-4820.05);
  });

  it("reads USD rows without converting them", () => {
    const [a] = parse(
      "2026-01-05,2026-01-06,ROHIT PRAKASH,Individual,23904403,Buy,ALPHABET CL C CAP STOCK,GOOG,8,317.29,USD,-2548.24,USD",
    );
    expect(a.price_currency).toBe("USD");
    expect(a.currency).toBe("USD");
    expect(a.amount).toBe(-2548.24);
  });
});
