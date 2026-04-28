import pool from "../db/pool";
import { CreateAccountInput } from "../types";

export const AccountRepository = {
  findAll: async () => {
    const result = await pool.query(
      "SELECT * FROM accounts ORDER BY institution, name",
    );
    return result.rows;
  },

  create: async (data: CreateAccountInput) => {
    const result = await pool.query(
      `INSERT INTO accounts (name, type, institution, registered_type, currency, opening_balance, opening_balance_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
      [
        data.name,
        data.type,
        data.institution,
        data.registered_type ?? "none",
        data.currency ?? "CAD",
        data.opening_balance ?? 0,
        data.opening_balance_date ?? null,
      ],
    );
    return result.rows[0];
  },

  delete: async (id: number) => {
    await pool.query("DELETE FROM accounts WHERE id = $1", [id]);
  },

  findBalances: async () => {
    const result = await pool.query(`
    SELECT 
      a.id,
      a.name,
      a.type,
      a.institution,
      a.registered_type,
      a.currency,
      a.opening_balance,
      a.opening_balance_date,
      (
        COALESCE(a.opening_balance, 0) +
        COALESCE(SUM(
          CASE 
            WHEN a.opening_balance_date IS NULL THEN 0
            WHEN t.date > a.opening_balance_date THEN t.amount
            ELSE 0
          END
        ), 0)
      )::float as balance
    FROM accounts a
    LEFT JOIN transactions t ON t.account_id = a.id
    GROUP BY a.id
    ORDER BY a.type, a.name
  `);
    return result.rows;
  },

  updateBalance: async (
    id: number,
    opening_balance: number,
    opening_balance_date: string,
  ) => {
    const result = await pool.query(
      `UPDATE accounts 
     SET opening_balance = $1, opening_balance_date = $2
     WHERE id = $3
     RETURNING *`,
      [opening_balance, opening_balance_date, id],
    );
    return result.rows[0];
  },
};
