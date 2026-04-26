import { Router, Request, Response } from "express";
import { CategoryRepository } from "../repositories/categories.repository";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const rows = await CategoryRepository.findAll();
    res.json(CategoryRepository.buildTree(rows));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.get("/flat", async (req: Request, res: Response) => {
  try {
    const categories = await CategoryRepository.findFlat();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

export default router;
