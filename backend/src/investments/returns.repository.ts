import pool from "../db/pool";
import { simpleReturn, timeWeightedReturn, xirr, Valuation } from "./returns";

export type PeriodReturn = {
  label: string;
  from: string;
  to: string;
  portfolio: number | null;
  benchmark: number | null;
  /** Short windows are noise rather than signal; the UI should say so. */
  short_window: boolean;
};

export type ReturnsSummary = {
  benchmark: string;
  periods: PeriodReturn[];
  /** Annualised money-weighted return, so deposit timing counts. */
  xirr: number | null;
  income: {
    total_gain_cad: number;
    appreciation_cad: number;
    distributions_cad: number;
    withholding_cad: number;
  };
};

const BENCHMARK = "VFV.TO";
const PERIODS: { label: string; months: number }[] = [
  { label: "1 month", months: 1 },
  { label: "3 months", months: 3 },
  { label: "6 months", months: 6 },
  { label: "1 year", months: 12 },
];

/** Daily so the return is measured across every flow, not just month ends. */
const DAILY_VALUES = `
  WITH latest AS (
    SELECT account_id, max(date) AS date FROM holdings GROUP BY account_id
  ),
  current_holdings AS (
    SELECT h.account_id, h.security, h.units, h.settlement_currency
    FROM holdings h
    JOIN latest l ON l.account_id = h.account_id AND l.date = h.date
    WHERE true {SCOPE}
  ),
  days AS (
    SELECT generate_series(
      (SELECT min(date) FROM investment_activity {ACT_WHERE}),
      CURRENT_DATE, '1 day'::interval
    )::date AS day
  ),
  cash_now AS (
    SELECT COALESCE(sum(c.amount * CASE WHEN c.currency = 'CAD' THEN 1
             ELSE COALESCE((SELECT rate FROM exchange_rates
               WHERE from_currency = c.currency AND to_currency = 'CAD' AND date <= c.date
               ORDER BY date DESC LIMIT 1), 1) END), 0) AS amount
    FROM account_cash c
    JOIN latest l ON l.account_id = c.account_id AND l.date = c.date
    WHERE true {CASH_SCOPE}
  ),
  cad AS (
    SELECT a.id, a.date, a.activity_type, a.security, a.quantity,
           a.amount * CASE WHEN a.currency = 'CAD' THEN 1
             ELSE COALESCE((SELECT rate FROM exchange_rates
               WHERE from_currency = a.currency AND to_currency = 'CAD' AND date <= a.date
               ORDER BY date DESC LIMIT 1), 1) END AS amount_cad
    FROM investment_activity a
    WHERE true {ACT_SCOPE}
  )
  SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
         (
           COALESCE((
             SELECT sum(
               (ch.units - COALESCE((SELECT sum(t.quantity) FROM cad t
                 WHERE t.security = ch.security AND t.activity_type IN ('buy','sell')
                   AND t.date > d.day), 0))
               * p.price
               * CASE WHEN ch.settlement_currency = 'CAD' THEN 1 ELSE COALESCE(fx.rate, 1) END
             )
             FROM current_holdings ch
             LEFT JOIN LATERAL (
               SELECT price FROM prices WHERE security = ch.security AND date <= d.day
               ORDER BY date DESC LIMIT 1
             ) p ON true
             LEFT JOIN LATERAL (
               SELECT rate FROM exchange_rates
               WHERE from_currency = ch.settlement_currency AND to_currency = 'CAD'
                 AND date <= d.day ORDER BY date DESC LIMIT 1
             ) fx ON true
           ), 0)
           + (SELECT amount FROM cash_now)
           - COALESCE((SELECT sum(amount_cad) FROM cad WHERE date > d.day), 0)
         )::float AS value,
         COALESCE((
           SELECT sum(amount_cad) FROM cad
           WHERE date = d.day AND activity_type IN ('deposit','contribution','transfer')
         ), 0)::float AS flow
  FROM days d
  ORDER BY d.day
`;

export const ReturnsRepository = {
  summary: async (accountId?: number): Promise<ReturnsSummary> => {
    const scoped = (template: string) =>
      template
        .replace("{SCOPE}", accountId ? "AND h.account_id = $1" : "")
        .replace("{CASH_SCOPE}", accountId ? "AND c.account_id = $1" : "")
        .replace("{ACT_SCOPE}", accountId ? "AND a.account_id = $1" : "")
        .replace("{ACT_WHERE}", accountId ? "WHERE account_id = $1" : "");

    const params = accountId ? [accountId] : [];
    const { rows } = await pool.query(scoped(DAILY_VALUES), params);
    const series: Valuation[] = rows.map((r) => ({
      date: r.date,
      value: r.value,
      flow: r.flow,
    }));

    const { rows: benchRows } = await pool.query(
      `SELECT to_char(date,'YYYY-MM-DD') AS date,
              COALESCE(adj_close, price)::float AS price
       FROM prices WHERE security = $1 ORDER BY date`,
      [BENCHMARK],
    );
    const benchByDate = new Map<string, number>(
      benchRows.map((b) => [b.date, b.price]),
    );
    const benchDates = benchRows.map((b) => b.date);
    const priceOnOrBefore = (date: string): number | null => {
      let found: number | null = null;
      for (const d of benchDates) {
        if (d > date) break;
        found = benchByDate.get(d) ?? found;
      }
      return found;
    };

    const today = series[series.length - 1]?.date;
    const first = series[0]?.date;
    const periods: PeriodReturn[] = [];

    for (const { label, months } of PERIODS) {
      if (!today || !first) break;
      const start = new Date(`${today}T00:00:00`);
      start.setMonth(start.getMonth() - months);
      const from = start.toISOString().slice(0, 10);
      // A window reaching past the data would silently measure a shorter span.
      if (from < first) continue;

      const window = series.filter((p) => p.date >= from);
      const benchFrom = priceOnOrBefore(from);
      const benchTo = priceOnOrBefore(today);

      periods.push({
        label,
        from,
        to: today,
        portfolio: timeWeightedReturn(window),
        benchmark:
          benchFrom !== null && benchTo !== null
            ? simpleReturn(benchFrom, benchTo)
            : null,
        short_window: months < 3,
      });
    }

    if (first && today) {
      const benchFrom = priceOnOrBefore(first);
      const benchTo = priceOnOrBefore(today);
      periods.push({
        label: "Since start",
        from: first,
        to: today,
        portfolio: timeWeightedReturn(series),
        benchmark:
          benchFrom !== null && benchTo !== null
            ? simpleReturn(benchFrom, benchTo)
            : null,
        short_window: false,
      });
    }

    // Flows on the opening day are already inside the opening value, since that
    // value is measured at end of day. Counting them again would double count.
    const laterFlows = series.slice(1);
    const flows = laterFlows
      .filter((p) => p.flow !== 0)
      .map((p) => ({ date: p.date, amount: -p.flow }));
    const opening = series[0]?.value ?? 0;
    if (opening > 0 && first) {
      flows.unshift({ date: first, amount: -opening });
    }
    if (today) {
      flows.push({ date: today, amount: series[series.length - 1].value });
    }

    const { rows: incomeRows } = await pool.query(
      `SELECT
         COALESCE(sum(amount) FILTER (WHERE activity_type IN ('dividend','distribution','interest')), 0)::float AS distributions,
         COALESCE(sum(amount) FILTER (WHERE activity_type = 'withholding_tax'), 0)::float AS withholding
       FROM investment_activity
       ${accountId ? "WHERE account_id = $1" : ""}`,
      params,
    );

    const closing = series[series.length - 1]?.value ?? 0;
    const contributed = laterFlows.reduce((t, p) => t + p.flow, 0);
    const totalGain = closing - opening - contributed;
    const distributions = incomeRows[0]?.distributions ?? 0;
    const withholding = incomeRows[0]?.withholding ?? 0;

    return {
      benchmark: BENCHMARK,
      periods,
      xirr: xirr(flows),
      income: {
        total_gain_cad: totalGain,
        // Whatever is left once income is accounted for is price movement.
        appreciation_cad: totalGain - distributions - withholding,
        distributions_cad: distributions,
        withholding_cad: withholding,
      },
    };
  },
};
