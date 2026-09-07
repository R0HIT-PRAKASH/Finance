import { Router, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import pool from "../db/pool";
import { classifyMerchants, isConfigured } from "../classifier";
import { GroupsRepository } from "./groups.repository";
import { RulesRepository } from "./rules.repository";
import { TransfersRepository } from "./transfers";

const router = Router();

router.post("/transfers/detect", async (_req: Request, res: Response) => {
  try {
    const paired = await TransfersRepository.detectPairs();
    res.json({ paired });
  } catch (err) {
    console.error("Failed to detect transfers:", err);
    res.status(500).json({ error: "Failed to detect transfers" });
  }
});

router.get("/transfers/unmatched", async (_req: Request, res: Response) => {
  try {
    res.json(await TransfersRepository.findUnmatched());
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch unmatched transfers" });
  }
});

router.get("/groups", async (req: Request, res: Response) => {
  try {
    const groups = await GroupsRepository.findUncategorized({
      account_id: req.query.account_id
        ? parseInt(req.query.account_id as string)
        : undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
    });
    res.json(groups);
  } catch (err) {
    console.error("Failed to fetch groups:", err);
    res.status(500).json({ error: "Failed to fetch groups" });
  }
});

router.post("/groups/apply", async (req: Request, res: Response) => {
  const { transaction_ids, category_id, pattern } = req.body;

  if (!Array.isArray(transaction_ids) || !category_id) {
    res
      .status(400)
      .json({ error: "transaction_ids and category_id are required" });
    return;
  }

  try {
    const updated = await GroupsRepository.applyCategory(
      transaction_ids,
      category_id,
      pattern,
    );
    res.json({ updated });
  } catch (err) {
    console.error("Failed to apply category:", err);
    res.status(500).json({ error: "Failed to apply category" });
  }
});

// Suggestions are returned, never applied — the user confirms each one.
router.post("/suggest", async (_req: Request, res: Response) => {
  if (!isConfigured()) {
    res.status(503).json({ error: "ANTHROPIC_API_KEY is not configured" });
    return;
  }

  try {
    const groups = await GroupsRepository.findUncategorized();
    const merchants = groups
      .filter((g) => g.bulk_assignable && g.rulable)
      .map((g) => ({
        key: g.pattern,
        total_amount: g.total_amount,
        count: g.count,
      }));

    if (merchants.length === 0) {
      res.json({ suggestions: [] });
      return;
    }

    const [taxonomy, examples] = await Promise.all([
      pool.query(
        `SELECT c.id, c.name, c.kind, p.name as parent_name
         FROM categories c
         LEFT JOIN categories p ON c.parent_id = p.id
         WHERE NOT EXISTS (SELECT 1 FROM categories ch WHERE ch.parent_id = c.id)
         ORDER BY c.id`,
      ),
      pool.query(
        `SELECT DISTINCT ON (t.description) t.description, t.category_id
         FROM transactions t
         WHERE t.categorization_source = 'manual' AND t.category_id IS NOT NULL
         ORDER BY t.description, t.id DESC
         LIMIT 25`,
      ),
    ]);

    const suggestions = await classifyMerchants({
      merchants,
      taxonomy: taxonomy.rows,
      examples: examples.rows,
    });

    res.json({ suggestions });
  } catch (err) {
    console.error("Failed to suggest categories:", err);
    if (err instanceof Anthropic.AuthenticationError) {
      res.status(401).json({ error: "ANTHROPIC_API_KEY is invalid" });
    } else if (err instanceof Anthropic.RateLimitError) {
      res.status(429).json({ error: "Rate limited by Anthropic — try again shortly" });
    } else {
      res.status(500).json({ error: "Failed to suggest categories" });
    }
  }
});

router.get("/rules", async (_req: Request, res: Response) => {
  try {
    res.json(await RulesRepository.findAll());
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch rules" });
  }
});

router.post("/rules", async (req: Request, res: Response) => {
  const { pattern, category_id } = req.body;

  if (!pattern || !category_id) {
    res.status(400).json({ error: "pattern and category_id are required" });
    return;
  }

  try {
    res.status(201).json(await RulesRepository.create(pattern, category_id));
  } catch (err) {
    res.status(500).json({ error: "Failed to create rule" });
  }
});

router.delete("/rules/:id", async (req: Request, res: Response) => {
  try {
    await RulesRepository.delete(parseInt(req.params.id));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete rule" });
  }
});

router.post("/rules/apply", async (_req: Request, res: Response) => {
  try {
    const updated = await RulesRepository.applyToExisting();
    res.json({ updated });
  } catch (err) {
    console.error("Failed to apply rules:", err);
    res.status(500).json({ error: "Failed to apply rules" });
  }
});

export default router;
