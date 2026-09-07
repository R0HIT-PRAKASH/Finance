export type ParsedHolding = {
  symbol: string;
  description: string;
  quantity: number;
  /** Cost columns are in the settlement currency; market value is already CAD. */
  average_cost: number | null;
  current_price: number | null;
  total_cost: number | null;
  market_value_cad: number;
  unrealized_gain_cad: number | null;
  settlement_currency: string;
  asset_class: string | null;
  sector: string | null;
  previous_close: number | null;
  annual_dividend: number | null;
  dividend_yield: number | null;
  dividend_frequency: string | null;
  ex_dividend_date: string | null;
  beta: number | null;
  pe_ratio: number | null;
  eps: number | null;
  /** The broker's own weighting, used to reconcile the parse. */
  portfolio_pct: number | null;
};

export type ParsedHoldingsReport = {
  account_number: string;
  account_type: string;
  as_of: string;
  cash: { currency: string; amount: number }[];
  holdings: ParsedHolding[];
  usd_to_cad: number | null;
};

const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

/** Quote columns carry a currency suffix, as in "335.6 U" or "75.86 C". */
function num(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) && raw.trim() !== "" ? n : null;
}

export function parseInvestorlineHoldings(
  content: string,
): ParsedHoldingsReport {
  const lines = content.split(/\r?\n/).map((l) => l.trim());

  const header = content.match(
    /Portfolio report for (.+?) account # (\d+) as of \w{3} (\w{3}) (\d{2}) (\d{4})/,
  );
  if (!header) throw new Error("Not an InvestorLine portfolio report");
  const [, accountType, accountNumber, month, day, year] = header;

  const fx = content.match(/1 USD = ([\d.]+)\s*CAD/);

  const cash: { currency: string; amount: number }[] = [];
  const holdings: ParsedHolding[] = [];

  for (const line of lines) {
    const c = line.split(",").map((v) => v.trim());

    // Cash rows name a currency and an account type; the Total(in X) rows do not.
    if (/^[A-Z]{3}$/.test(c[0]) && c[1] && num(c[2]) !== null) {
      cash.push({ currency: c[0], amount: num(c[2])! });
      continue;
    }

    // Holdings carry a SYMBOL:EXCHANGE and enough columns for the market data.
    if (!/^[A-Z0-9.\-]+:[A-Z]{2}$/.test(c[0]) || c.length < 35) continue;

    const marketValue = num(c[9]);
    if (marketValue === null) continue;

    holdings.push({
      symbol: c[0],
      description: c[1],
      quantity: num(c[2]) ?? 0,
      average_cost: num(c[3]),
      current_price: num(c[5]),
      total_cost: num(c[7]),
      market_value_cad: marketValue,
      unrealized_gain_cad: num(c[11]),
      settlement_currency: c[16] || "CAD",
      asset_class: c[14] || null,
      sector: c[15] || null,
      previous_close: num(c[24]),
      annual_dividend: num(c[26]),
      dividend_yield: num(c[28]),
      ex_dividend_date: /^\d{4}-\d{2}-\d{2}$/.test(c[29]) ? c[29] : null,
      dividend_frequency: c[30] || null,
      beta: num(c[31]),
      pe_ratio: num(c[32]),
      eps: num(c[33]),
      portfolio_pct: num(c[34]),
    });
  }

  return {
    account_number: accountNumber,
    account_type: accountType,
    as_of: `${year}-${MONTHS[month]}-${day}`,
    cash,
    holdings,
    usd_to_cad: fx ? Number(fx[1]) : null,
  };
}
