import pool from "../db/pool";

export type TransactionFilters = {
  account_id?: number;
  category_id?: number;
  uncategorized?: boolean;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export const TransactionRepository = {
  findAll: async (filters: TransactionFilters = {}) => {
    const conditions: string[] = [];
    const params: any[] = [];
    let p = 1;

    if (filters.account_id) {
      conditions.push(`t.account_id = $${p++}`);
      params.push(filters.account_id);
    }

    if (filters.category_id) {
      conditions.push(`t.category_id = $${p++}`);
      params.push(filters.category_id);
    }

    if (filters.uncategorized) {
      conditions.push(`t.category_id IS NULL`);
    }

    if (filters.from) {
      conditions.push(`t.date >= $${p++}`);
      params.push(filters.from);
    }

    if (filters.to) {
      conditions.push(`t.date <= $${p++}`);
      params.push(filters.to);
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = filters.limit ?? 100;
    const offset = filters.offset ?? 0;

    const query = `
      SELECT 
        t.id,
        to_char(t.date, 'YYYY-MM-DD') as date,
        t.account_id,
        a.name as account_name,
        t.amount::float as amount,
        t.currency,
        t.merchant_name,
        t.description,
        t.category_id,
        c.name as category_name,
        cp.name as category_parent_name,
        t.categorization_source,
        t.categorization_confidence
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN categories cp ON c.parent_id = cp.id
      ${where}
      ORDER BY t.date DESC, t.id DESC
      LIMIT $${p++} OFFSET $${p++}
    `;

    params.push(limit, offset);

    const [data, count] = await Promise.all([
      pool.query(query, params),
      pool.query(
        `SELECT COUNT(*) as total FROM transactions t ${where}`,
        params.slice(0, -2),
      ),
    ]);

    return {
      transactions: data.rows,
      total: parseInt(count.rows[0].total),
      limit,
      offset,
    };
  },

  updateCategory: async (
    id: number,
    category_id: number,
    save_rule: boolean,
  ) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const result = await client.query(
        `UPDATE transactions
         SET category_id = $1,
             categorization_source = 'manual'
         WHERE id = $2
         RETURNING *`,
        [category_id, id],
      );

      if (save_rule && result.rows[0]?.merchant_name) {
        await client.query(
          `INSERT INTO merchant_rules (merchant_name, category_id, source)
           VALUES ($1, $2, 'manual')
           ON CONFLICT (merchant_name) DO UPDATE
           SET category_id = $2, source = 'manual'`,
          [result.rows[0].merchant_name, category_id],
        );
      }

      await client.query("COMMIT");
      return result.rows[0];
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  insertMany: async (
    transactions: {
      date: string;
      account_id: number;
      amount: number;
      currency: string;
      description: string;
      merchant_name: string;
    }[],
  ) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = [];

      for (const tx of transactions) {
        // Check if merchant rule exists
        const rule = await client.query(
          `SELECT category_id FROM merchant_rules WHERE merchant_name = $1`,
          [tx.merchant_name],
        );

        const category_id = rule.rows[0]?.category_id ?? null;
        const source = category_id ? "rule" : null;

        const result = await client.query(
          `INSERT INTO transactions 
            (date, account_id, amount, currency, description, merchant_name, category_id, categorization_source)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            tx.date,
            tx.account_id,
            tx.amount,
            tx.currency,
            tx.description,
            tx.merchant_name,
            category_id,
            source,
          ],
        );
        inserted.push(result.rows[0]);
      }

      await client.query("COMMIT");
      return inserted;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },
};
