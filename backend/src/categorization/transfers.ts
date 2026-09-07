import pool from "../db/pool";

const MAX_DAYS_APART = 5;

/**
 * Links the two sides of a movement between accounts the user owns, the outflow
 * from one account and the matching inflow into another. A paired transaction is
 * not spending: the money never left the user's control, so reports exclude it.
 */
export const TransfersRepository = {
  detectPairs: async (): Promise<number> => {
    const { rows: candidates } = await pool.query(
      `SELECT out.id AS out_id, inc.id AS in_id,
              out.account_id AS out_account, inc.account_id AS in_account,
              abs(inc.date - out.date) AS days_apart,
              out.category_id AS out_category, inc.category_id AS in_category,
              out_a.type AS out_type, inc_a.type AS in_type
       FROM transactions out
       JOIN transactions inc
         ON inc.account_id <> out.account_id
        AND inc.amount = -out.amount
        AND abs(inc.date - out.date) <= $1
       JOIN accounts out_a ON out_a.id = out.account_id
       JOIN accounts inc_a ON inc_a.id = inc.account_id
       WHERE out.amount < 0
         AND out.transfer_pair_id IS NULL
         AND inc.transfer_pair_id IS NULL
       ORDER BY abs(inc.date - out.date), out.id`,
      [MAX_DAYS_APART],
    );

    // A candidate row per possible match, so claim greedily, closest dates first.
    const used = new Set<number>();
    const pairs = candidates.filter((c) => {
      if (used.has(c.out_id) || used.has(c.in_id)) return false;
      used.add(c.out_id);
      used.add(c.in_id);
      return true;
    });

    if (pairs.length === 0) return 0;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const ccPaymentId = (
        await client.query(
          "SELECT id FROM categories WHERE name = 'Credit Card Payment'",
        )
      ).rows[0]?.id;

      for (const pair of pairs) {
        const pairId = Math.min(pair.out_id, pair.in_id);
        await client.query(
          "UPDATE transactions SET transfer_pair_id = $1 WHERE id = ANY($2::int[])",
          [pairId, [pair.out_id, pair.in_id]],
        );

        const involvesCredit =
          pair.out_type === "credit" || pair.in_type === "credit";
        if (involvesCredit && ccPaymentId) {
          await client.query(
            `UPDATE transactions
             SET category_id = $1, categorization_source = 'rule'
             WHERE id = ANY($2::int[]) AND category_id IS NULL`,
            [ccPaymentId, [pair.out_id, pair.in_id]],
          );
        }
      }

      await client.query("COMMIT");
      return pairs.length;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /** Transfers categorized as such but with no counterpart found in the data. */
  findUnmatched: async () => {
    const { rows } = await pool.query(
      `SELECT t.id, to_char(t.date, 'YYYY-MM-DD') as date, t.description,
              t.amount::float as amount, a.name as account_name
       FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       JOIN categories c ON c.id = t.category_id
       WHERE c.kind = 'transfer' AND t.transfer_pair_id IS NULL
       ORDER BY t.date DESC`,
    );
    return rows;
  },
};
