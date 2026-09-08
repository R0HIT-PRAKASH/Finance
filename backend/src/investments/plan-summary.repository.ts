import pool from "../db/pool";
import { PlanSummary } from "../parsers/canadalife-summary.parser";

export type PlanSummaryImportResult = {
  account: string;
  plan: string;
  period_start: string;
  period_end: string;
  contributions_cad: number;
  market_change_cad: number;
  created: boolean;
};

export const PlanSummaryRepository = {
  save: async (summary: PlanSummary): Promise<PlanSummaryImportResult> => {
    // The two CanadaLife plans hold identical funds in identical amounts, so
    // the registered type alone cannot separate them. Whether the money came
    // from the member or the employer is the discriminator: employer money is
    // the DPSP.
    const registeredType = summary.contributor === "employer" ? "DPSP" : summary.plan;

    const { rows: accounts } = await pool.query(
      `SELECT id, name FROM accounts
       WHERE institution ILIKE '%canadalife%' AND registered_type = $1
       LIMIT 1`,
      [registeredType],
    );
    if (accounts.length === 0) {
      throw new Error(
        `No CanadaLife account with registered type ${registeredType}`,
      );
    }
    const account = accounts[0];

    const { rows } = await pool.query(
      `INSERT INTO plan_period_summary
         (account_id, period_start, period_end, opening_value_cad,
          contributions_cad, market_change_cad, closing_value_cad)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (account_id, period_start, period_end) DO UPDATE
       SET opening_value_cad = EXCLUDED.opening_value_cad,
           contributions_cad = EXCLUDED.contributions_cad,
           market_change_cad = EXCLUDED.market_change_cad,
           closing_value_cad = EXCLUDED.closing_value_cad
       RETURNING (xmax = 0) AS created`,
      [
        account.id,
        summary.period_start,
        summary.period_end,
        summary.opening_value_cad,
        summary.contributions_cad,
        summary.market_change_cad,
        summary.closing_value_cad,
      ],
    );

    return {
      account: account.name,
      plan: summary.plan,
      period_start: summary.period_start,
      period_end: summary.period_end,
      contributions_cad: summary.contributions_cad,
      market_change_cad: summary.market_change_cad,
      created: rows[0]?.created ?? false,
    };
  },

  findAll: async () => {
    const { rows } = await pool.query(
      `SELECT a.name AS account, a.institution,
              to_char(s.period_start,'YYYY-MM-DD') AS period_start,
              to_char(s.period_end,'YYYY-MM-DD') AS period_end,
              s.opening_value_cad::float, s.contributions_cad::float,
              s.market_change_cad::float, s.closing_value_cad::float
       FROM plan_period_summary s
       JOIN accounts a ON a.id = s.account_id
       ORDER BY s.period_end DESC, a.name`,
    );
    return rows;
  },
};
