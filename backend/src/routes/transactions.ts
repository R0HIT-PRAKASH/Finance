import { Router, Request, Response } from "express";
import { TransactionRepository } from "../repositories/transactions.repository";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const result = await TransactionRepository.findAll({
      account_id: req.query.account_id
        ? parseInt(req.query.account_id as string)
        : undefined,
      category_id: req.query.category_id
        ? parseInt(req.query.category_id as string)
        : undefined,
      uncategorized: req.query.uncategorized === "true",
      from: req.query.from as string,
      to: req.query.to as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset
        ? parseInt(req.query.offset as string)
        : undefined,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

router.patch("/:id/category", async (req: Request, res: Response) => {
  try {
    const result = await TransactionRepository.updateCategory(
      parseInt(req.params.id),
      req.body.category_id,
      req.body.save_rule ?? false,
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to update category" });
  }
});

export default router;
