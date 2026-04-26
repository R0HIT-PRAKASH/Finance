import { Router, Request, Response } from "express";
import { AccountRepository } from "../repositories/accounts.repository";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const accounts = await AccountRepository.findAll();
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch accounts" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const account = await AccountRepository.create(req.body);
    res.status(201).json(account);
  } catch (err) {
    res.status(500).json({ error: "Failed to create account" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    await AccountRepository.delete(parseInt(req.params.id));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;
