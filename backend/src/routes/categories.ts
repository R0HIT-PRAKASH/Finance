import { Router } from "express";
import pool from "../db/pool";

const router = Router();

// GET /categories - returns full tree
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM categories ORDER BY parent_id NULLS FIRST, name"
    );
    const rows = result.rows;

    // Build tree structure
    const map: Record<number, any> = {};
    const roots: any[] = [];

    for (const row of rows) {
      map[row.id] = { ...row, children: [] };
    }

    for (const row of rows) {
      if (row.parent_id === null) {
        roots.push(map[row.id]);
      } else {
        map[row.parent_id]?.children.push(map[row.id]);
      }
    }

    res.json(roots);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// GET /categories/flat - flat list for dropdowns
router.get("/flat", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.name, p.name as parent_name
       FROM categories c
       LEFT JOIN categories p ON c.parent_id = p.id
       ORDER BY p.name NULLS FIRST, c.name`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

export default router;
