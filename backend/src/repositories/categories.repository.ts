import pool from "../db/pool";

export const CategoryRepository = {
  findAll: async () => {
    const result = await pool.query(
      "SELECT * FROM categories ORDER BY parent_id NULLS FIRST, name",
    );
    return result.rows;
  },

  /**
   * Assignable categories only. Parent nodes exist to roll their children up in
   * reports, so a transaction is never filed against one directly.
   */
  findFlat: async () => {
    const result = await pool.query(
      `SELECT c.id, c.name, c.kind, p.name as parent_name
       FROM categories c
       LEFT JOIN categories p ON c.parent_id = p.id
       WHERE NOT EXISTS (SELECT 1 FROM categories ch WHERE ch.parent_id = c.id)
       ORDER BY p.name NULLS FIRST, c.name`,
    );
    return result.rows;
  },

  buildTree: (rows: any[]) => {
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

    return roots;
  },
};
