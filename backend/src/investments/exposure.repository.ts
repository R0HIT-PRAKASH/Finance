import pool from "../db/pool";

export type Slice = {
  label: string;
  value_cad: number;
  percentage: number;
  /** True when the split came from the statement rather than look-through data. */
  estimated?: boolean;
};

export type Concentration = {
  top_position: { security: string; percentage: number } | null;
  top_five_pct: number;
  largest_sector: { label: string; percentage: number } | null;
  positions: number;
};

export type TaxSplit = {
  treatment: "Registered" | "Taxable";
  accounts: string[];
  value_cad: number;
  unrealized_cad: number | null;
};

export type Exposure = {
  sectors: Slice[];
  asset_classes: Slice[];
  currencies: Slice[];
  concentration: Concentration;
  tax: TaxSplit[];
  income: {
    annual_cad: number;
    yield_pct: number;
    by_security: Slice[];
  };
  /** Securities with no look-through data, so their own sector was used whole. */
  securities_without_lookthrough: string[];
};

const LATEST = `
  SELECT account_id, max(date) AS date FROM holdings GROUP BY account_id
`;

function withShare(rows: { label: string; value_cad: number }[]): Slice[] {
  const total = rows.reduce((t, r) => t + r.value_cad, 0);
  return rows.map((r) => ({
    ...r,
    percentage: total === 0 ? 0 : (r.value_cad / total) * 100,
  }));
}

export const ExposureRepository = {
  find: async (accountId?: number): Promise<Exposure> => {
    const scope = accountId ? "AND h.account_id = $1" : "";
    const params = accountId ? [accountId] : [];

    const held = `
      WITH latest AS (${LATEST}),
      held AS (
        SELECT h.security, h.units, h.market_value_cad, h.settlement_currency,
               h.book_value_cad, h.unrealized_gain_cad, h.account_id
        FROM holdings h
        JOIN latest l ON l.account_id = h.account_id AND l.date = h.date
        WHERE true ${scope}
      )
    `;

    // A security with look-through weights is split across sectors; one without
    // contributes its whole value to the sector the statement gave it.
    const { rows: sectors } = await pool.query(
      `${held}
       SELECT COALESCE(w.sector, s.sector, 'Unclassified') AS label,
              sum(h.market_value_cad * COALESCE(w.weight, 1))::float AS value_cad
       FROM held h
       LEFT JOIN securities s ON s.symbol = h.security
       LEFT JOIN security_sector_weights w ON w.security = h.security
       GROUP BY 1 ORDER BY 2 DESC`,
      params,
    );

    const { rows: assets } = await pool.query(
      `${held}
       SELECT
         sum(h.market_value_cad * COALESCE(s.stock_position, 1))::float AS equity,
         sum(h.market_value_cad * COALESCE(s.bond_position, 0))::float AS bonds,
         sum(h.market_value_cad * COALESCE(s.cash_position, 0))::float AS cash,
         sum(h.market_value_cad * COALESCE(s.other_position, 0))::float AS other
       FROM held h LEFT JOIN securities s ON s.symbol = h.security`,
      params,
    );

    const { rows: currencies } = await pool.query(
      `${held}
       SELECT h.settlement_currency AS label,
              sum(h.market_value_cad)::float AS value_cad
       FROM held h GROUP BY 1 ORDER BY 2 DESC`,
      params,
    );

    const { rows: positions } = await pool.query(
      `${held}
       SELECT h.security AS label, sum(h.market_value_cad)::float AS value_cad
       FROM held h GROUP BY 1 ORDER BY 2 DESC`,
      params,
    );

    const { rows: tax } = await pool.query(
      `${held}
       SELECT CASE WHEN a.registered_type IN ('Non-registered','none')
                   THEN 'Taxable' ELSE 'Registered' END AS treatment,
              array_agg(DISTINCT a.name) AS accounts,
              sum(h.market_value_cad)::float AS value_cad,
              sum(h.unrealized_gain_cad)::float AS unrealized_cad
       FROM held h JOIN accounts a ON a.id = h.account_id
       GROUP BY 1 ORDER BY 3 DESC`,
      params,
    );

    const { rows: income } = await pool.query(
      `${held}, px AS (
         SELECT DISTINCT ON (security) security, annual_dividend
         FROM prices WHERE annual_dividend IS NOT NULL
         ORDER BY security, date DESC
       )
       SELECT h.security AS label,
              sum(h.units * px.annual_dividend)::float AS value_cad
       FROM held h JOIN px ON px.security = h.security
       GROUP BY 1 HAVING sum(h.units * px.annual_dividend) > 0
       ORDER BY 2 DESC`,
      params,
    );

    const { rows: missing } = await pool.query(
      `${held}
       SELECT DISTINCT h.security
       FROM held h
       WHERE NOT EXISTS (
         SELECT 1 FROM security_sector_weights w WHERE w.security = h.security
       )
       ORDER BY 1`,
      params,
    );

    const totalValue = positions.reduce((t, p) => t + p.value_cad, 0);
    const annualIncome = income.reduce((t, r) => t + r.value_cad, 0);
    const sectorSlices = withShare(sectors);
    const a = assets[0] ?? {};

    return {
      sectors: sectorSlices,
      asset_classes: withShare(
        [
          { label: "Equity", value_cad: a.equity ?? 0 },
          { label: "Bonds", value_cad: a.bonds ?? 0 },
          { label: "Cash", value_cad: a.cash ?? 0 },
          { label: "Other", value_cad: a.other ?? 0 },
        ].filter((s) => s.value_cad > 0),
      ),
      currencies: withShare(currencies),
      concentration: {
        top_position: positions[0]
          ? {
              security: positions[0].label,
              percentage:
                totalValue === 0 ? 0 : (positions[0].value_cad / totalValue) * 100,
            }
          : null,
        top_five_pct:
          totalValue === 0
            ? 0
            : (positions.slice(0, 5).reduce((t, p) => t + p.value_cad, 0) /
                totalValue) *
              100,
        largest_sector: sectorSlices[0]
          ? { label: sectorSlices[0].label, percentage: sectorSlices[0].percentage }
          : null,
        positions: positions.length,
      },
      tax: tax.map((t) => ({
        treatment: t.treatment,
        accounts: t.accounts,
        value_cad: t.value_cad,
        unrealized_cad: t.unrealized_cad,
      })),
      income: {
        annual_cad: annualIncome,
        yield_pct: totalValue === 0 ? 0 : (annualIncome / totalValue) * 100,
        by_security: withShare(income),
      },
      securities_without_lookthrough: missing.map((m) => m.security),
    };
  },
};
