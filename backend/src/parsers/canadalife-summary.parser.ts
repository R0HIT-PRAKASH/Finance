export type PlanSummary = {
  plan: string;
  period_start: string;
  period_end: string;
  opening_value_cad: number;
  contributions_cad: number;
  market_change_cad: number;
  closing_value_cad: number;
  /** Employer money means a DPSP; member money means the member's own RRSP. */
  contributor: "member" | "employer";
};

const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
};

function toIso(month: string, day: string, year: string): string {
  return `${year}-${MONTHS[month.toLowerCase()]}-${day.padStart(2, "0")}`;
}

function money(raw: string): number {
  return Number(raw.replace(/[$,]/g, ""));
}

/**
 * Reads the summary block of a CanadaLife activity report. The detailed
 * activity table below it is deliberately not parsed: pdftotext shreds each row
 * across seven interleaved lines, whereas this block extracts cleanly and
 * already carries the contribution-versus-growth split.
 *
 * Takes extracted text rather than a PDF so it stays pure and testable.
 */
export function parseCanadaLifeSummary(text: string): PlanSummary {
  const values = [
    ...text.matchAll(
      /Value of this plan on\s+\$?([\d,]+\.\d{2})\s*\n?\s*(\w+)\s+(\d{1,2}),\s*(\d{4})/g,
    ),
  ];
  if (values.length < 2) {
    throw new Error("Could not find both plan values in this report");
  }

  // The employer wording wraps, putting the amount before the word "company":
  //   "Contributions made by the $3,497.16\n company"
  // so the phrase cannot be matched whole.
  const contributions = text.match(
    /Contributions?\s+(you\s+made|made\s+by\s+the)\s+\$?([\d,]+\.\d{2})/,
  );
  const change = text.match(
    /Change in the market value\s*\$?([\d,]+\.\d{2})/,
  );
  if (!contributions || !change) {
    throw new Error("Could not find contributions or market change");
  }

  // The wording is the only thing distinguishing the two plans: they hold the
  // same funds in the same amounts and differ solely by who contributed.
  const contributor = contributions[1].includes("made by")
    ? "employer"
    : "member";

  const [open, close] = values;
  const plan = text.match(/^\s*(RRSP|DPSP|TFSA|FHSA)\s*$/m)?.[1] ?? "Unknown";

  const summary: PlanSummary = {
    plan,
    period_start: toIso(open[2], open[3], open[4]),
    period_end: toIso(close[2], close[3], close[4]),
    opening_value_cad: money(open[1]),
    contributions_cad: money(contributions[2]),
    market_change_cad: money(change[1]),
    closing_value_cad: money(close[1]),
    contributor,
  };

  // The report states all four figures, so they must reconcile. If they do not,
  // the extraction picked up the wrong numbers.
  const implied =
    summary.opening_value_cad +
    summary.contributions_cad +
    summary.market_change_cad;
  if (Math.abs(implied - summary.closing_value_cad) > 0.01) {
    throw new Error(
      `Summary does not reconcile: ${summary.opening_value_cad} + ${summary.contributions_cad} + ${summary.market_change_cad} is ${implied.toFixed(2)}, not ${summary.closing_value_cad}`,
    );
  }

  return summary;
}
