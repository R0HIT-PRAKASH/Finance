import { describe, expect, it } from "vitest";
import { parseBMOCredit } from "../../src/parsers/bmo-credit.parser";
import { parseRogers } from "../../src/parsers/rogers.parser";
import { parseScotia } from "../../src/parsers/scotia.parser";
import { parseAmount, parseCsvRows } from "../../src/parsers/csv";

describe("parseCsvRows", () => {
  it("keeps a comma inside a quoted field", () => {
    expect(parseCsvRows('a,"b,c",d')).toEqual([["a", "b,c", "d"]]);
  });

  it("keeps a newline inside a quoted field", () => {
    expect(parseCsvRows('a,"line one\nline two",c')).toEqual([
      ["a", "line one\nline two", "c"],
    ]);
  });

  it("skips blank rows", () => {
    expect(parseCsvRows("a,b\n\n\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});

describe("parseAmount", () => {
  it.each([
    ["$8.54", 8.54],
    ["-$490.07", -490.07],
    ["1,234.56", 1234.56],
    ["-35.91", -35.91],
  ])("parses %s", (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected);
  });

  it("returns null for empty or non-numeric input", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
    expect(parseAmount("n/a")).toBeNull();
  });
});

const BMO_CC = `Following data is valid as of 20260907205051:

Item #,Card #,Transaction Date,Posting Date,Transaction Amount,Description
1,'5191230222826670',20260814,20260814,-35.91,TRSF FROM/DE ACCT/CPT 2559-XXXX-515
2,'5191230222826670',20260828,20260831,1.46,APPLE.COM/BILL TORONTO ON`;

describe("parseBMOCredit", () => {
  it("reads the amount column, not the posting date", () => {
    // Regression: the chequing layout puts the amount one column earlier, so
    // reusing that parser here reads 20260814 as the amount.
    const rows = parseBMOCredit(BMO_CC);
    expect(rows.map((r) => r.amount)).toEqual([35.91, -1.46]);
  });

  it("uses the transaction date rather than the posting date", () => {
    const [, purchase] = parseBMOCredit(BMO_CC);
    expect(purchase.date).toBe("2026-08-28"); // posted 08-31
  });

  it("negates so a purchase is money out and a payment money in", () => {
    const [payment, purchase] = parseBMOCredit(BMO_CC);
    expect(payment.amount).toBeGreaterThan(0);
    expect(purchase.amount).toBeLessThan(0);
  });

  it("skips the preamble and header", () => {
    expect(parseBMOCredit(BMO_CC)).toHaveLength(2);
  });
});

const ROGERS = `Date,Posted Date,Reference Number,Activity Type,Activity Status,Card Number,Merchant Category Description,Merchant Name,Merchant City,Merchant State or Province,Merchant Country Code,Merchant Postal Code,Amount,Rewards,Name on Card
2026-07-25,2026-07-27,"55134426206800209325096",TRANS,APPROVED,************8656,Discount Store,DOLLARAMA # 818,VANCOUVER,BC,CA,V6B,$8.54,0.08,ROHIT PRAKASH
2026-07-08,2026-07-10,"55134426206800209325097",TRANS,APPROVED,************8656,Payment,PAYMENT THANK YOU,,,,,-$490.07,0,ROHIT PRAKASH`;

describe("parseRogers", () => {
  it("reads merchant name and dollar-prefixed amounts", () => {
    const [purchase, payment] = parseRogers(ROGERS);
    expect(purchase).toMatchObject({
      date: "2026-07-25",
      description: "DOLLARAMA # 818",
      amount: -8.54,
    });
    expect(payment.amount).toBe(490.07);
  });

  it("ignores the header row", () => {
    expect(parseRogers(ROGERS)).toHaveLength(2);
  });
});

const SCOTIA = `Filter,Date,Description,Sub-description,Status,Type of Transaction,Amount
"All available transactions (up to 2 years), From date=2026-06-05","2026-09-03","payment - thank you - ban","K Of Mont","posted","Credit","-203.50"
"","2026-08-20","chexy rent               ","Toronto On","posted","Debit","2543.75"`;

describe("parseScotia", () => {
  it("handles the filter text in the first row's leading column", () => {
    // That first cell contains a comma inside quotes and must not shift columns.
    const [payment] = parseScotia(SCOTIA);
    expect(payment.date).toBe("2026-09-03");
    expect(payment.amount).toBe(203.5);
  });

  it("joins description and sub-description, collapsing the padding", () => {
    const [, rent] = parseScotia(SCOTIA);
    expect(rent.description).toBe("chexy rent Toronto On");
    expect(rent.amount).toBe(-2543.75);
  });

  it("turns a debit into money out and a credit into money in", () => {
    const [payment, rent] = parseScotia(SCOTIA);
    expect(payment.amount).toBeGreaterThan(0);
    expect(rent.amount).toBeLessThan(0);
  });
});
