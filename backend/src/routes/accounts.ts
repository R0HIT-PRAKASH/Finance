import { Router } from "express";
import pool from "../db/pool";

const router = Router();

// GET /accounts
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM accounts ORDER BY institution, name"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch accounts" });
  }
});

// POST /accounts
router.post("/", async (req, res) => {
  const { name, type, institution, registered_type, currency } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO accounts (name, type, institution, registered_type, currency)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, type, institution, registered_type ?? "none", currency ?? "CAD"]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create account" });
  }
});

// DELETE /accounts/:id
router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM accounts WHERE id = $1", [req.params.id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;
