import { Router, Request, Response } from "express";
import pool from "../db/pool";
import { TransactionRepository } from "../repositories/transactions.repository";
import { getParser } from "../parsers";
import { TransfersRepository } from "../categorization/transfers";

const router = Router();

// POST /import
// Body: { account_id, csv_content }
// Automatically detects parser from account's institution + type
router.post("/", async (req: Request, res: Response) => {
  const { account_id, csv_content } = req.body;

  if (!account_id || !csv_content) {
    res.status(400).json({ error: "account_id and csv_content are required" });
    return;
  }

  try {
    // Look up account to get institution and type
    const accountResult = await pool.query(
      "SELECT * FROM accounts WHERE id = $1",
      [account_id],
    );

    if (accountResult.rows.length === 0) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    const account = accountResult.rows[0];
    const parser = getParser(account.institution, account.type);

    if (!parser) {
      res.status(400).json({
        error: `No parser available for ${account.institution} ${account.type}. Supported: BMO Chequing, Amex Credit.`,
      });
      return;
    }

    const transactions = parser(csv_content);

    if (transactions.length === 0) {
      res.status(400).json({ error: "No transactions found in CSV" });
      return;
    }

    const { inserted, skipped } = await TransactionRepository.insertMany(
      transactions.map((tx) => ({
        date: tx.date,
        account_id,
        amount: tx.amount,
        currency: account.currency,
        description: tx.description,
        merchant_name: tx.description,
      })),
    );

    // New rows may complete a transfer whose other side was already imported.
    const paired = await TransfersRepository.detectPairs();

    res.status(201).json({
      imported: inserted.length,
      skipped,
      paired,
      transactions: inserted,
    });
  } catch (err) {
    console.error("Import error:", err);
    // A file in the wrong format is the user's to fix, not a server fault.
    const message =
      err instanceof Error ? err.message : "Failed to import transactions";
    res.status(400).json({ error: message });
  }
});

export default router;
