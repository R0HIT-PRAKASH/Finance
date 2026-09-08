import pool from "../db/pool";

export type SeriesPoint = {
  date: string;
  value_cad: number;
  /** Opening value plus every contribution since, i.e. money you put in. */
  invested_cad: number;
  /** Value minus invested: growth over the charted window, not lifetime. */
  gain_cad: number;
  /** The same cash flows put into the benchmark instead. */
  benchmark_cad: number | null;
};

export type PerformanceSeries = {
  account_id: number | null;
  points: SeriesPoint[];
  benchmark: string | null;
  /** True once the window starts after the account did, so gain is partial. */
  opening_value_cad: number;
};

const BENCHMARK = "VFV.TO";

/**
 * Positions are reconstructed backwards from the latest snapshot rather than
 * accumulated forwards from the ledger, because the ledger may begin after the
 * account did. The snapshot is authoritative; trades only say how it got there.
 */
const UNITS_AT = `
  SELECT d.day, h.security, h.settlement_currency,
         h.units - COALESCE((
           SELECT sum(a.quantity) FROM investment_activity a
           WHERE a.security = h.security
             AND a.account_id = h.account_id
             AND a.activity_type IN ('buy', 'sell')
             AND a.date > d.day
         ), 0) AS units
  FROM days d
  CROSS JOIN current_holdings h
`;

export const PerformanceRepository = {
  series: async (accountId?: number): Promise<PerformanceSeries> => {
    const scope = accountId ? "AND h.account_id = $1" : "";
    const activityScope = accountId ? "WHERE account_id = $1" : "";
    const params = accountId ? [accountId] : [];

    const { rows } = await pool.query(
      `
      WITH latest AS (
        SELECT account_id, max(date) AS date FROM holdings GROUP BY account_id
      ),
      current_holdings AS (
        SELECT h.account_id, h.security, h.units, h.settlement_currency
        FROM holdings h
        JOIN latest l ON l.account_id = h.account_id AND l.date = h.date
        WHERE true ${scope}
      ),
      bounds AS (
        SELECT COALESCE(min(date), CURRENT_DATE) AS first_day
        FROM investment_activity ${activityScope}
      ),
      days AS (
        -- Month ends across the window, plus today so the line reaches now.
        SELECT DISTINCT day::date FROM (
          SELECT generate_series(
            (SELECT first_day FROM bounds),
            CURRENT_DATE,
            '1 month'::interval
          ) AS day
          UNION ALL SELECT CURRENT_DATE
        ) s
      ),
      units AS (${UNITS_AT}),
      priced AS (
        SELECT u.day,
               u.units * p.price *
                 CASE WHEN u.settlement_currency = 'CAD' THEN 1
                      ELSE COALESCE(fx.rate, 1) END AS value_cad
        FROM units u
        LEFT JOIN LATERAL (
          SELECT price FROM prices
          WHERE security = u.security AND date <= u.day
          ORDER BY date DESC LIMIT 1
        ) p ON true
        LEFT JOIN LATERAL (
          SELECT rate FROM exchange_rates
          WHERE from_currency = u.settlement_currency
            AND to_currency = 'CAD' AND date <= u.day
          ORDER BY date DESC LIMIT 1
        ) fx ON true
      ),
      cash_now AS (
        SELECT sum(c.amount *
                 CASE WHEN c.currency = 'CAD' THEN 1
                      ELSE COALESCE((
                        SELECT rate FROM exchange_rates
                        WHERE from_currency = c.currency AND to_currency = 'CAD'
                          AND date <= c.date ORDER BY date DESC LIMIT 1
                      ), 1) END) AS amount
        FROM account_cash c
        JOIN latest l ON l.account_id = c.account_id AND l.date = c.date
        WHERE true ${accountId ? "AND c.account_id = $1" : ""}
      ),
      -- Every activity row moves cash, so running it backwards from the
      -- current balance gives cash held on any past date.
      cash AS (
        SELECT d.day,
               (SELECT amount FROM cash_now) - COALESCE(sum(
                 a.amount * CASE WHEN a.currency = 'CAD' THEN 1
                   ELSE COALESCE((
                     SELECT rate FROM exchange_rates
                     WHERE from_currency = a.currency AND to_currency = 'CAD'
                       AND date <= a.date ORDER BY date DESC LIMIT 1
                   ), 1) END
               ) FILTER (WHERE a.date > d.day), 0) AS amount
        FROM days d
        LEFT JOIN investment_activity a
          ON true ${accountId ? "AND a.account_id = $1" : ""}
        GROUP BY d.day
      ),
      flows AS (
        SELECT d.day,
               COALESCE(sum(a.amount) FILTER (WHERE a.date <= d.day), 0) AS contributed
        FROM days d
        LEFT JOIN investment_activity a
          ON a.activity_type IN ('deposit', 'contribution', 'transfer')
          ${accountId ? "AND a.account_id = $1" : ""}
        GROUP BY d.day
      ),
      bench AS (
        -- Units of the benchmark the same cash flows would have bought.
        SELECT d.day,
               COALESCE(sum(
                 a.amount / NULLIF((
                   SELECT price FROM prices
                   WHERE security = '${BENCHMARK}' AND date <= a.date
                   ORDER BY date DESC LIMIT 1
                 ), 0)
               ) FILTER (WHERE a.date <= d.day), 0) AS units
        FROM days d
        LEFT JOIN investment_activity a
          ON a.activity_type IN ('deposit', 'contribution', 'transfer')
          ${accountId ? "AND a.account_id = $1" : ""}
        GROUP BY d.day
      )
      SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
             (COALESCE(sum(pr.value_cad), 0) + max(ch.amount))::float AS value_cad,
             max(f.contributed)::float AS contributed_cad,
             max(b.units)::float AS bench_units,
             (SELECT price FROM prices
              WHERE security = '${BENCHMARK}' AND date <= d.day
              ORDER BY date DESC LIMIT 1)::float AS bench_price
      FROM days d
      LEFT JOIN priced pr ON pr.day = d.day
      LEFT JOIN flows f ON f.day = d.day
      LEFT JOIN cash ch ON ch.day = d.day
      LEFT JOIN bench b ON b.day = d.day
      GROUP BY d.day
      ORDER BY d.day
      `,
      params,
    );

    if (rows.length === 0) {
      return {
        account_id: accountId ?? null,
        points: [],
        benchmark: null,
        opening_value_cad: 0,
      };
    }

    // Growth is measured from where the window opens, since anything the
    // account earned before the ledger began is not attributable here.
    const opening = rows[0].value_cad ?? 0;
    const openingContributed = rows[0].contributed_cad ?? 0;
    const openingBenchUnits = rows[0].bench_units ?? 0;
    const benchSeedUnits =
      rows[0].bench_price > 0 ? opening / rows[0].bench_price : 0;

    const points: SeriesPoint[] = rows.map((r) => {
      const contributedSince = (r.contributed_cad ?? 0) - openingContributed;
      const invested = opening + contributedSince;
      const benchUnits =
        benchSeedUnits + ((r.bench_units ?? 0) - openingBenchUnits);
      return {
        date: r.date,
        value_cad: r.value_cad ?? 0,
        invested_cad: invested,
        gain_cad: (r.value_cad ?? 0) - invested,
        benchmark_cad: r.bench_price ? benchUnits * r.bench_price : null,
      };
    });

    return {
      account_id: accountId ?? null,
      points,
      benchmark: BENCHMARK,
      opening_value_cad: opening,
    };
  },
};
