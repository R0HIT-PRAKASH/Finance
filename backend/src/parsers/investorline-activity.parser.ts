export type ActivityType =
  | "buy"
  | "sell"
  | "dividend"
  | "distribution"
  | "interest"
  | "withholding_tax"
  | "deposit"
  | "contribution"
  | "transfer"
  | "fx"
  | "other";

export type ParsedActivity = {
  date: string;
  settlement_date: string | null;
  account_number: string;
  account_type: string;
  activity_type: ActivityType;
  raw_activity: string;
  description: string;
  security: string | null;
  quantity: number | null;
  price: number | null;
  price_currency: string | null;
  amount: number;
  currency: string;
};

/**
 * BMO labels ETF distributions "Interest", so the word alone is ambiguous. A
 * row carrying a security symbol is a fund distribution; without one it is
 * genuine cash interest.
 */
function classify(rawActivity: string, hasSecurity: boolean): ActivityType {
  const activity = rawActivity.trim().toLowerCase();
  if (activity === "buy") return "buy";
  if (activity === "sell") return "sell";
  if (activity === "dividend") return "dividend";
  if (activity === "interest") return hasSecurity ? "distribution" : "interest";
  if (activity === "non resident tax") return "withholding_tax";
  if (activity === "deposit") return "deposit";
  if (activity === "contribution") return "contribution";
  if (activity === "transfer of funds") return "transfer";
  if (activity === "foreign exchange") return "fx";
  return "other";
}

function splitRow(line: string): string[] {
  const cols: string[] = [];
  let field = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === "," && !inQuotes) {
      cols.push(field.trim());
      field = "";
    } else field += ch;
  }
  cols.push(field.trim());
  return cols;
}

function toNumber(raw: string): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function parseInvestorlineActivity(content: string): ParsedActivity[] {
  const rows: ParsedActivity[] = [];

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    // Skips the filter preamble, the header, and the dashed rule under it.
    if (!trimmed || !/^\d{4}-\d{2}-\d{2},/.test(trimmed)) continue;

    const c = splitRow(trimmed);
    if (c.length < 13) continue;

    const security = c[7] || null;
    const rawActivity = c[5].trim();
    // Multi-fill orders put the cash on one row and zero on the others, so
    // amount is authoritative for money and quantity for units. Never derive
    // one from the other: totals include commission.
    const amount = toNumber(c[11]);
    if (amount === null) continue;

    rows.push({
      date: c[0],
      settlement_date: c[1] || null,
      account_number: c[4],
      account_type: c[3],
      activity_type: classify(rawActivity, Boolean(security)),
      raw_activity: rawActivity,
      description: c[6],
      security,
      quantity: toNumber(c[8]),
      price: toNumber(c[9]),
      price_currency: c[10] || null,
      amount,
      currency: c[12] || "CAD",
    });
  }

  return rows;
}
