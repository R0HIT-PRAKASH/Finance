import { Router, Request, Response } from "express";
import { CategoryRepository } from "../repositories/categories.repository";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const rows = await CategoryRepository.findAll();
    res.json(CategoryRepository.buildTree(rows));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.get("/flat", async (_req: Request, res: Response) => {
  try {
    res.json(await CategoryRepository.findFlat());
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  const { name, parent_id } = req.body;
  if (!name?.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  try {
    res
      .status(201)
      .json(
        await CategoryRepository.create(name, parent_id ?? null, req.body.kind),
      );
  } catch (err) {
    // Depth and parent errors are the user's to act on, not server faults.
    const message = err instanceof Error ? err.message : "Failed to create";
    res.status(400).json({ error: message });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name?.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  try {
    res.json(await CategoryRepository.rename(parseInt(req.params.id), name));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to rename";
    res.status(400).json({ error: message });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    res.json(await CategoryRepository.remove(parseInt(req.params.id)));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete";
    res.status(400).json({ error: message });
  }
});

export default router;
