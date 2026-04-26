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
      `INSERT INTO accounts (name, type, institution, registered_type, currency)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.name,
        data.type,
        data.institution,
        data.registered_type ?? "none",
        data.currency ?? "CAD",
      ],
    );
    return result.rows[0];
  },

  delete: async (id: number) => {
    await pool.query("DELETE FROM accounts WHERE id = $1", [id]);
  },
};
