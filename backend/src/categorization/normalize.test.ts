import { describe, expect, it } from "vitest";
import { isPersonTransfer, normalizeDescription } from "./normalize";

describe("normalizeDescription", () => {
  it("strips the bank's transaction-type prefix", () => {
    expect(normalizeDescription("[DN]AMAZON WEB SERV PAY/PAY")).toBe(
      "AMAZON WEB SERV PAY/PAY",
    );
  });

  it.each([
    ["[PR]THE FIRST DESSE VANCOUVER BC CAN", "THE FIRST DESSE"],
    ["MARUGAME UDON - BEATTY Vancouver", "MARUGAME UDON - BEATTY"],
    ["UBER TRIP TORONTO", "UBER TRIP"],
    ["[PR]MOM'S DIMSUM NORTH YORK ON CAN", "MOM'S DIMSUM"],
  ])("truncates trailing place names: %s", (input, expected) => {
    expect(normalizeDescription(input)).toBe(expected);
  });

  it.each([
    ["TIM HORTONS #5795 TORONTO", "TIM HORTONS"],
    ["BOOSTER JUICE #594 TORO TORONTO", "BOOSTER JUICE"],
    ["PHOLICIOUS 00-080418152 VANCOUVER", "PHOLICIOUS"],
    ["FIDO MOBILE ******9005 888-481-3436", "FIDO MOBILE"],
    ["LYFT *RIDE TUE 1AM VANCOUVER", "LYFT *RIDE"],
  ])("truncates at store numbers, codes and times: %s", (input, expected) => {
    expect(normalizeDescription(input)).toBe(expected);
  });

  it("keeps a place name that begins the merchant name", () => {
    // Regression: BC is a province code, but here it is part of the merchant.
    expect(normalizeDescription("[CW]BC HYDRO")).toBe("BC HYDRO");
  });

  it("keeps the counterparty on person-to-person transfers", () => {
    // Regression: these were once collapsed to "INTERAC ETRNSFR AD RECVD",
    // which merged unrelated senders into one group.
    expect(
      normalizeDescription(
        "[CW]INTERAC ETRNSFR AD RECVD NEETA PRAKASH 20261031224ZVAZHR",
      ),
    ).toBe("INTERAC ETRNSFR AD RECVD NEETA PRAKASH");
    expect(
      normalizeDescription("[CW]INTERAC ETRNSFR SENT YUTO 20261012333XUAJWQ"),
    ).toBe("INTERAC ETRNSFR SENT YUTO");
  });

  it("distinguishes senders so they never share a rule", () => {
    const a = normalizeDescription(
      "[CW]INTERAC ETRNSFR AD RECVD AMIT PRAKASH 202609321013KHUPC",
    );
    const b = normalizeDescription(
      "[CW]INTERAC ETRNSFR AD RECVD JACKY WANG 20261012355MYUECN",
    );
    expect(a).not.toBe(b);
  });

  it("falls back to the type prefix when nothing survives", () => {
    expect(normalizeDescription("[TF]2390440317 RTCT0000051951")).toBe("TF");
    expect(normalizeDescription("[CW] TF 0005191230222826670")).toBe("TF");
  });

  it("returns OTHER when there is no prefix to fall back on", () => {
    expect(normalizeDescription("999999999")).toBe("OTHER");
  });

  it("leaves clean descriptions untouched", () => {
    expect(normalizeDescription("MEMBERSHIP FEE INSTALLMENT")).toBe(
      "MEMBERSHIP FEE INSTALLMENT",
    );
    expect(normalizeDescription("[DS]AMEX BILL PYMT MSP/DIV")).toBe(
      "AMEX BILL PYMT MSP/DIV",
    );
  });

  it("groups the same merchant across differing suffixes", () => {
    expect(normalizeDescription("LYFT *RIDE TUE 1AM VANCOUVER")).toBe(
      normalizeDescription("LYFT *RIDE WED 9PM VANCOUVER"),
    );
  });

  it("produces a key that is a substring of the original", () => {
    // Rules match with LIKE '%key%', so a non-contiguous key would never fire.
    const raw = "TST-SHAMROCK BAR & GRI VANCOUVER";
    expect(raw.toUpperCase()).toContain(normalizeDescription(raw));
  });
});

describe("isPersonTransfer", () => {
  it("detects interac transfers in both directions", () => {
    expect(isPersonTransfer("[CW]INTERAC ETRNSFR SENT ANDREW 2026")).toBe(true);
    expect(isPersonTransfer("[CW]INTERAC ETRNSFR AD RECVD LEO WANG 2026")).toBe(
      true,
    );
  });

  it("does not flag ordinary merchants or bank transfers", () => {
    expect(isPersonTransfer("TIM HORTONS #5795 TORONTO")).toBe(false);
    expect(isPersonTransfer("[TF]2390440317 RTCT0000051951")).toBe(false);
    expect(isPersonTransfer("[DS]AMEX BILL PYMT MSP/DIV")).toBe(false);
  });
});
