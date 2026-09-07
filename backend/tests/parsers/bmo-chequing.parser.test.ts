import { describe, expect, it } from "vitest";
import { parseBMOChequing } from "../../src/parsers/bmo-chequing.parser";

const HEADER =
  "First Bank Card,Transaction Type,Date Posted,Transaction Amount,Description";

describe("parseBMOChequing", () => {
  it("converts the posted date to ISO", () => {
    const [tx] = parseBMOChequing(
      `${HEADER}\n5191230222826670,DEBIT,20260907,-38.92,[PR]LYFT *RIDE`,
    );
    expect(tx.date).toBe("2026-09-07");
  });

  it("keeps the sign of the amount", () => {
    const rows = parseBMOChequing(
      `${HEADER}
5191230222826670,DEBIT,20260907,-38.92,[PR]LYFT *RIDE
5191230222826670,CREDIT,20260904,3176.13,[DN]AMAZON WEB SERV PAY/PAY`,
    );
    expect(rows.map((r) => r.amount)).toEqual([-38.92, 3176.13]);
  });

  it("strips surrounding quotes from quoted columns", () => {
    // Regression: quotes used to survive into the description, which broke
    // the [XX] prefix stripping downstream in normalizeDescription.
    const [tx] = parseBMOChequing(
      `${HEADER}\n'5191230222826670',DEBIT,20260907,-38.92,'[PR]LYFT *RIDE TUE 1AM VANCOUVER'`,
    );
    expect(tx.description).toBe("[PR]LYFT *RIDE TUE 1AM VANCOUVER");
  });

  it("parses quoted and bare rows identically", () => {
    const quoted = parseBMOChequing(
      `${HEADER}\n'5191230222826670',DEBIT,20260907,-38.92,'[PR]LYFT *RIDE'`,
    );
    const bare = parseBMOChequing(
      `${HEADER}\n5191230222826670,DEBIT,20260907,-38.92,[PR]LYFT *RIDE`,
    );
    expect(quoted).toEqual(bare);
  });

  it("skips rows without an 8-digit date, including preamble and blanks", () => {
    const rows = parseBMOChequing(
      `Following data is valid as of 20260907
${HEADER}

5191230222826670,DEBIT,20260907,-38.92,[PR]LYFT *RIDE
some trailing note`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe("[PR]LYFT *RIDE");
  });

  it("collapses runs of whitespace in the description", () => {
    const [tx] = parseBMOChequing(
      `${HEADER}\n5191230222826670,DEBIT,20260907,-1.00,[CW]INTERAC   ETRNSFR    SENT   YUTO`,
    );
    expect(tx.description).toBe("[CW]INTERAC ETRNSFR SENT YUTO");
  });

  it("returns nothing for a header-only file", () => {
    expect(parseBMOChequing(HEADER)).toEqual([]);
  });
});
