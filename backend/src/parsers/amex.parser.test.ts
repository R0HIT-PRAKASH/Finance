import { describe, expect, it } from "vitest";
import { parseAmex } from "./amex.parser";

const HEADER = "Date,Reference,Description,Amount";

describe("parseAmex", () => {
  it("converts the statement date to ISO", () => {
    const [tx] = parseAmex(
      `${HEADER}\n16 Mar 2026,ref1,STRAIGHT OUTTA BROOKLYN VANCOUVER,12.74`,
    );
    expect(tx.date).toBe("2026-03-16");
  });

  it("pads single-digit days", () => {
    const [tx] = parseAmex(`${HEADER}\n3 Jul 2026,ref1,CHIPOTLE,14.28`);
    expect(tx.date).toBe("2026-07-03");
  });

  it("negates charges so spending is consistently negative", () => {
    // Amex reports a purchase as positive; the rest of the app treats
    // outflows as negative, as the chequing export already does.
    const [tx] = parseAmex(`${HEADER}\n17 Mar 2026,ref1,CHIPOTLE 4160,14.28`);
    expect(tx.amount).toBe(-14.28);
  });

  it("turns a payment received into a positive amount", () => {
    const [tx] = parseAmex(
      `${HEADER}\n17 Mar 2026,ref1,PAYMENT RECEIVED - THANK YOU,-3571.47`,
    );
    expect(tx.amount).toBe(3571.47);
  });

  it("handles newlines inside quoted fields", () => {
    const rows = parseAmex(
      `${HEADER}\n20 Mar 2026,ref1,"MARUGAME UDON\nVANCOUVER",13.11`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe("MARUGAME UDON VANCOUVER");
  });

  it("skips rows whose date does not parse", () => {
    const rows = parseAmex(
      `${HEADER}
Totals for period,,,999.99
17 Mar 2026,ref1,CHIPOTLE,14.28`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe("CHIPOTLE");
  });

  it("returns nothing for a header-only file", () => {
    expect(parseAmex(HEADER)).toEqual([]);
  });
});
