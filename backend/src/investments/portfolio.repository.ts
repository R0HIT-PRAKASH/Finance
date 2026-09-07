import pool from "../db/pool";

export type Position = {
  security: string;
  description: string | null;
  asset_class: string | null;
  sector: string | null;
  units: number;
  settlement_currency: string;
  average_cost: number | null;
  current_price: number | null;
  market_value_cad: number;
  book_value_cad: number | null;
  unrealized_gain_cad: number | null;
};

export type CashBalance = {
  currency: string;
  amount: number;
  amount_cad: number;
  /** True when no snapshot-date FX rate existed, so amount_cad is unconverted. */
  rate_missing: boolean;
};

export type AccountPortfolio = {
  account_id: number;
  account_name: string;
  institution: string;
  registered_type: string;
  as_of: string | null;
  market_value_cad: number;
  cash_cad: number;
  /** Securities plus cash — what the account is actually worth. */
  total_value_cad: number;
  /** Null when the source reports no lifetime cost basis (e.g. group plans). */
  book_value_cad: number | null;
  unrealized_gain_cad: number | null;
  unrealized_pct: number | null;
  cash: CashBalance[];
  positions: Position[];
};

export type PortfolioTotals = {
  securities_cad: number;
  cash_cad: number;
  total_value_cad: number;
  /** Gain figures cover only holdings with a known cost basis. */
  book_value_cad: number;
  unrealized_gain_cad: number;
  unrealized_pct: number;
  /** Market value excluded from the gain figures for lack of a cost basis. */
  market_value_without_basis: number;
  accounts_without_basis: number;
  as_of_earliest: string | null;
  as_of_latest: string | null;
  funded_accounts: number;
};

export type Allocation = {
  label: string;
  market_value_cad: number;
  percentage: number;
};

function pct(gain: number, basis: number): number {
  return basis === 0 ? 0 : (gain / basis) * 100;
}

/** Latest snapshot date per account — accounts are imported independently. */
const LATEST_PER_ACCOUNT = `
  SELECT account_id, max(date) AS date FROM holdings GROUP BY account_id
`;

export const PortfolioRepository = {
  findAll: async (): Promise<AccountPortfolio[]> => {
    const { rows } = await pool.query(`
      WITH latest AS (${LATEST_PER_ACCOUNT})
      SELECT a.id AS account_id, a.name AS account_name, a.institution,
             a.registered_type,
             to_char(l.date, 'YYYY-MM-DD') AS as_of,
             h.security, s.description, s.asset_class, s.sector,
             h.units::float, h.settlement_currency,
             h.average_cost::float, p.price::float AS current_price,
             h.market_value_cad::float, h.book_value_cad::float,
             h.unrealized_gain_cad::float
      FROM accounts a
      LEFT JOIN latest l ON l.account_id = a.id
      LEFT JOIN holdings h ON h.account_id = a.id AND h.date = l.date
      LEFT JOIN securities s ON s.symbol = h.security
      LEFT JOIN prices p ON p.security = h.security AND p.date = l.date
      WHERE a.type = 'investment'
      ORDER BY a.id, h.market_value_cad DESC NULLS LAST
    `);

    // Foreign cash is converted with the snapshot-date rate so it can be
    // summed; dropping it would silently understate the account.
    const { rows: cashRows } = await pool.query(`
      WITH latest AS (${LATEST_PER_ACCOUNT})
      SELECT c.account_id, c.currency, c.amount::float,
             (c.amount * COALESCE(
               CASE WHEN c.currency = 'CAD' THEN 1 ELSE fx.rate END, 1
             ))::float AS amount_cad,
             (c.currency <> 'CAD' AND fx.rate IS NULL) AS rate_missing
      FROM account_cash c
      JOIN latest l ON l.account_id = c.account_id AND l.date = c.date
      LEFT JOIN exchange_rates fx
        ON fx.date = c.date AND fx.from_currency = c.currency
       AND fx.to_currency = 'CAD'
      ORDER BY c.currency
    `);

    const byAccount = new Map<number, AccountPortfolio>();

    for (const r of rows) {
      if (!byAccount.has(r.account_id)) {
        byAccount.set(r.account_id, {
          account_id: r.account_id,
          account_name: r.account_name,
          institution: r.institution,
          registered_type: r.registered_type,
          as_of: r.as_of,
          market_value_cad: 0,
          cash_cad: 0,
          total_value_cad: 0,
          book_value_cad: 0,
          unrealized_gain_cad: 0,
          unrealized_pct: 0,
          cash: [],
          positions: [],
        });
      }
      const account = byAccount.get(r.account_id)!;
      if (!r.security) continue; // account exists but has no snapshot yet

      account.positions.push({
        security: r.security,
        description: r.description,
        asset_class: r.asset_class,
        sector: r.sector,
        units: r.units,
        settlement_currency: r.settlement_currency,
        average_cost: r.average_cost,
        current_price: r.current_price,
        market_value_cad: r.market_value_cad,
        book_value_cad: r.book_value_cad,
        unrealized_gain_cad: r.unrealized_gain_cad,
      });
      account.market_value_cad += r.market_value_cad ?? 0;
    }

    for (const c of cashRows) {
      const account = byAccount.get(c.account_id);
      if (!account) continue;
      account.cash.push({
        currency: c.currency,
        amount: c.amount,
        amount_cad: c.amount_cad,
        rate_missing: c.rate_missing,
      });
      account.cash_cad += c.amount_cad;
    }

    for (const account of byAccount.values()) {
      account.total_value_cad = account.market_value_cad + account.cash_cad;

      const withBasis = account.positions.filter(
        (p) => p.book_value_cad !== null,
      );
      if (withBasis.length === 0) {
        account.book_value_cad = null;
        account.unrealized_gain_cad = null;
        account.unrealized_pct = null;
        continue;
      }
      account.book_value_cad = withBasis.reduce(
        (t, p) => t + p.book_value_cad!,
        0,
      );
      account.unrealized_gain_cad = withBasis.reduce(
        (t, p) => t + (p.unrealized_gain_cad ?? 0),
        0,
      );
      account.unrealized_pct = pct(
        account.unrealized_gain_cad,
        account.book_value_cad,
      );
    }

    return [...byAccount.values()];
  },

  summarize: (accounts: AccountPortfolio[]): PortfolioTotals => {
    const funded = accounts.filter((a) => a.as_of !== null);
    const dates = [...new Set(funded.map((a) => a.as_of!))].sort();
    const sum = (pick: (a: AccountPortfolio) => number) =>
      funded.reduce((total, a) => total + pick(a), 0);

    // Group plans report no lifetime cost basis, so including their market
    // value in the gain calculation would understate the return percentage.
    const noBasis = funded.filter((a) => a.book_value_cad === null);
    const book = sum((a) => a.book_value_cad ?? 0);
    const gain = sum((a) => a.unrealized_gain_cad ?? 0);

    return {
      securities_cad: sum((a) => a.market_value_cad),
      cash_cad: sum((a) => a.cash_cad),
      total_value_cad: sum((a) => a.total_value_cad),
      book_value_cad: book,
      unrealized_gain_cad: gain,
      unrealized_pct: pct(gain, book),
      market_value_without_basis: noBasis.reduce(
        (t, a) => t + a.total_value_cad,
        0,
      ),
      accounts_without_basis: noBasis.length,
      as_of_earliest: dates[0] ?? null,
      as_of_latest: dates[dates.length - 1] ?? null,
      funded_accounts: funded.length,
    };
  },

  /** Groups the latest positions by one of the security's descriptive fields. */
  allocationBy: async (field: "sector" | "asset_class"): Promise<Allocation[]> => {
    const { rows } = await pool.query(`
      WITH latest AS (${LATEST_PER_ACCOUNT})
      SELECT COALESCE(s.${field}, 'Unclassified') AS label,
             sum(h.market_value_cad)::float AS market_value_cad,
             (sum(h.market_value_cad)
               / NULLIF(sum(sum(h.market_value_cad)) OVER (), 0) * 100)::float
               AS percentage
      FROM holdings h
      JOIN latest l ON l.account_id = h.account_id AND l.date = h.date
      LEFT JOIN securities s ON s.symbol = h.security
      GROUP BY 1
      ORDER BY 2 DESC
    `);
    return rows;
  },
};
