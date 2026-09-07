import pool from "../db/pool";

export type Rule = {
  id: number;
  pattern: string;
  category_id: number;
  category_name: string | null;
  category_parent_name: string | null;
  source: string;
  created_at: string;
};

export const RulesRepository = {
  findAll: async (): Promise<Rule[]> => {
    const { rows } = await pool.query(
      `SELECT r.id, r.pattern, r.category_id,
              c.name as category_name,
              cp.name as category_parent_name,
              r.source, r.created_at
       FROM merchant_rules r
       LEFT JOIN categories c ON r.category_id = c.id
       LEFT JOIN categories cp ON c.parent_id = cp.id
       ORDER BY r.pattern`,
    );
    return rows;
  },

  create: async (pattern: string, category_id: number): Promise<Rule> => {
    const { rows } = await pool.query(
      `INSERT INTO merchant_rules (pattern, category_id, source)
       VALUES ($1, $2, 'manual')
       ON CONFLICT (pattern) DO UPDATE
       SET category_id = EXCLUDED.category_id, source = 'manual'
       RETURNING *`,
      [pattern.toUpperCase(), category_id],
    );
    return rows[0];
  },

  delete: async (id: number): Promise<void> => {
    await pool.query("DELETE FROM merchant_rules WHERE id = $1", [id]);
  },

  /** Applies every rule to transactions that are still uncategorized. */
  applyToExisting: async (): Promise<number> => {
    const { rows: rules } = await pool.query(
      "SELECT pattern, category_id FROM merchant_rules",
    );

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let updated = 0;

      for (const rule of rules) {
        const result = await client.query(
          `UPDATE transactions
           SET category_id = $1, categorization_source = 'rule'
           WHERE category_id IS NULL
             AND UPPER(description) LIKE '%' || UPPER($2) || '%'`,
          [rule.category_id, rule.pattern],
        );
        updated += result.rowCount ?? 0;
      }

      await client.query("COMMIT");
      return updated;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },
};
