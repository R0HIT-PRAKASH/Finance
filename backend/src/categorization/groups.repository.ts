import pool from "../db/pool";
import { isPersonTransfer, normalizeDescription } from "./normalize";

export type GroupFilters = {
  account_id?: number;
  from?: string;
  to?: string;
};

export type GroupedTransaction = {
  id: number;
  date: string;
  description: string;
  amount: number;
};

export type TransactionGroup = {
  pattern: string;
  count: number;
  total_amount: number;
  /** False when the key can't serve as a LIKE pattern (opaque numeric refs). */
  rulable: boolean;
  /** False when members need individual judgment — see isPersonTransfer. */
  bulk_assignable: boolean;
  transactions: GroupedTransaction[];
};

function stripPrefix(description: string): string {
  return description.toUpperCase().replace(/^\[[A-Z]{2}\]/, "");
}

export const GroupsRepository = {
  findUncategorized: async (
    filters: GroupFilters = {},
  ): Promise<TransactionGroup[]> => {
    const conditions = ["t.category_id IS NULL"];
    const params: any[] = [];
    let p = 1;

    if (filters.account_id) {
      conditions.push(`t.account_id = $${p++}`);
      params.push(filters.account_id);
    }
    if (filters.from) {
      conditions.push(`t.date >= $${p++}`);
      params.push(filters.from);
    }
    if (filters.to) {
      conditions.push(`t.date <= $${p++}`);
      params.push(filters.to);
    }

    const { rows } = await pool.query(
      `SELECT t.id, to_char(t.date, 'YYYY-MM-DD') as date,
              t.description, t.amount::float as amount
       FROM transactions t
       WHERE ${conditions.join(" AND ")}
       ORDER BY t.date DESC`,
      params,
    );

    const grouped = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = normalizeDescription(row.description);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    }

    return [...grouped.entries()]
      .map(([pattern, items]) => {
        const bulkAssignable = !items.some((i) => isPersonTransfer(i.description));
        return {
          pattern,
          count: items.length,
          total_amount: items.reduce((sum, i) => sum + i.amount, 0),
          rulable:
            bulkAssignable &&
            pattern.length >= 3 &&
            items.every((i) => stripPrefix(i.description).includes(pattern)),
          bulk_assignable: bulkAssignable,
          transactions: items.map((i) => ({
            id: i.id,
            date: i.date,
            description: i.description,
            amount: i.amount,
          })),
        };
      })
      .sort((a, b) => b.count - a.count);
  },

  /** Categorizes a set of transactions, optionally saving the pattern as a rule. */
  applyCategory: async (
    transaction_ids: number[],
    category_id: number,
    pattern?: string,
  ): Promise<number> => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const result = await client.query(
        `UPDATE transactions
         SET category_id = $1, categorization_source = 'manual'
         WHERE id = ANY($2::int[])`,
        [category_id, transaction_ids],
      );

      if (pattern) {
        await client.query(
          `INSERT INTO merchant_rules (pattern, category_id, source)
           VALUES ($1, $2, 'manual')
           ON CONFLICT (pattern) DO UPDATE
           SET category_id = EXCLUDED.category_id, source = 'manual'`,
          [pattern, category_id],
        );
      }

      await client.query("COMMIT");
      return result.rowCount ?? 0;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },
};
