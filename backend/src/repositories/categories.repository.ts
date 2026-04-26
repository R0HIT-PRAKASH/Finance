import pool from "../db/pool";

export const CategoryRepository = {
  findAll: async () => {
    const result = await pool.query(
      "SELECT * FROM categories ORDER BY parent_id NULLS FIRST, name",
    );
    return result.rows;
  },

  findFlat: async () => {
    const result = await pool.query(
      `SELECT c.id, c.name, p.name as parent_name
       FROM categories c
       LEFT JOIN categories p ON c.parent_id = p.id
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
