import { Router, Request, Response } from "express";
import { parse } from "csv-parse";
import pool from "../db/pool";

const router = Router();

type ParsedTransaction = {
  date: string;
  amount: number;
  description: string;
  type: "CREDIT" | "DEBIT";
};

function parseBMOChequing(content: string): ParsedTransaction[] {
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Skip header row
  const dataLines = lines.slice(1);

  return dataLines.map((line) => {
    // Split by comma but respect quoted fields
    const cols = line.match(/('.*?'|[^,]+)/g)?.map((c) => c.trim()) ?? [];

    const transactionType = cols[1] as "CREDIT" | "DEBIT";
    const rawDate = cols[2]; // YYYYMMDD
    const amount = parseFloat(cols[3]);
    const description = cols[4]?.replace(/\s+/g, " ").trim() ?? "";

    // Convert YYYYMMDD to YYYY-MM-DD
    const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;

    return { date, amount, description, type: transactionType };
  });
}

// POST /import/bmo-chequing
router.post("/bmo-chequing", async (req: Request, res: Response) => {
  const { account_id, csv_content } = req.body;

  if (!account_id || !csv_content) {
    res.status(400).json({ error: "account_id and csv_content are required" });
    return;
  }

  try {
    const transactions = parseBMOChequing(csv_content);

    if (transactions.length === 0) {
      res.status(400).json({ error: "No transactions found in CSV" });
      return;
    }

    // Insert all transactions
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const inserted = [];
      for (const tx of transactions) {
        const result = await client.query(
          `INSERT INTO transactions 
            (date, account_id, amount, currency, description, merchant_name)
           VALUES ($1, $2, $3, 'CAD', $4, $5)
           RETURNING *`,
          [tx.date, account_id, tx.amount, tx.description, tx.description],
        );
        inserted.push(result.rows[0]);
      }

      await client.query("COMMIT");
      res
        .status(201)
        .json({ imported: inserted.length, transactions: inserted });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Import error:", err);
    res.status(500).json({ error: "Failed to import transactions" });
  }
});

// GET /import/transactions/:account_id
router.get("/transactions/:account_id", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT t.*, c.name as category_name, c.parent_id as category_parent_id
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.account_id = $1
       ORDER BY t.date DESC`,
      [req.params.account_id],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

export default router;
