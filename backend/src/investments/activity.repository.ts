import pool from "../db/pool";
import { ParsedActivity } from "../parsers/investorline-activity.parser";

export type ActivityImportResult = {
  imported: number;
  skipped: number;
  /** Account numbers in the file with no matching account, so those rows were left out. */
  unknown_accounts: string[];
  accounts: string[];
  from: string | null;
  to: string | null;
};

export const ActivityRepository = {
  importRows: async (rows: ParsedActivity[]): Promise<ActivityImportResult> => {
    const { rows: accounts } = await pool.query(
      "SELECT id, name, account_number FROM accounts WHERE account_number IS NOT NULL",
    );
    const byNumber = new Map<string, { id: number; name: string }>(
      accounts.map((a) => [a.account_number, { id: a.id, name: a.name }]),
    );

    const unknown = new Set<string>();
    const touched = new Set<string>();
    const dates: string[] = [];

    // Numbered within the file so re-importing an overlapping range conflicts
    // away, the same approach used for bank transactions.
    const seen = new Map<string, number>();
    let imported = 0;
    let skipped = 0;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (const row of rows) {
        const account = byNumber.get(row.account_number);
        if (!account) {
          unknown.add(row.account_number);
          continue;
        }
        touched.add(account.name);
        dates.push(row.date);

        const key = [
          account.id,
          row.date,
          row.raw_activity,
          row.description,
          row.quantity,
          row.amount,
        ].join("|");
        const occurrence = (seen.get(key) ?? 0) + 1;
        seen.set(key, occurrence);

        const result = await client.query(
          `INSERT INTO investment_activity
             (date, settlement_date, account_id, activity_type, raw_activity,
              description, security, quantity, price, price_currency,
              amount, currency, occurrence)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT ON CONSTRAINT investment_activity_natural_key_unique DO NOTHING
           RETURNING id`,
          [
            row.date,
            row.settlement_date,
            account.id,
            row.activity_type,
            row.raw_activity,
            row.description,
            row.security,
            row.quantity,
            row.price,
            row.price_currency,
            row.amount,
            row.currency,
            occurrence,
          ],
        );
        if (result.rows[0]) imported += 1;
        else skipped += 1;
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    dates.sort();
    return {
      imported,
      skipped,
      unknown_accounts: [...unknown],
      accounts: [...touched],
      from: dates[0] ?? null,
      to: dates[dates.length - 1] ?? null,
    };
  },
};
