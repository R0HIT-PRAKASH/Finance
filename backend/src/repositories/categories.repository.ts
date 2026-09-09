import pool from "../db/pool";

/** Three levels is plenty for a personal budget and keeps pickers readable. */
export const MAX_DEPTH = 3;

/** Matches the categories_kind_check constraint. */
export const KINDS = ["income", "expense", "transfer"];

export type FlatCategory = {
  id: number;
  name: string;
  kind: string;
  parent_id: number | null;
  parent_name: string | null;
  /** The top-level ancestor, which is what a sector rollup groups by. */
  root_id: number;
  root_name: string;
  depth: number;
  /** Full ancestry, so a picker can show where a category sits. */
  path: string;
  /** False when other categories hang off this one. */
  is_leaf: boolean;
  transaction_count: number;
};

/**
 * Every category is assignable, including parents. A transaction that is
 * clearly "Living Expenses" but ambiguous between Food and Transport is more
 * honestly filed on the parent than guessed onto a leaf. Rollups read the
 * assigned category and walk to its root, so mixed depth costs nothing.
 */
const TREE = `
  WITH RECURSIVE tree AS (
    SELECT id, name, kind, parent_id, id AS root_id, name AS root_name,
           1 AS depth, name::text AS path
    FROM categories WHERE parent_id IS NULL
    UNION ALL
    SELECT c.id, c.name, c.kind, c.parent_id, t.root_id, t.root_name,
           t.depth + 1, t.path || ' > ' || c.name
    FROM categories c JOIN tree t ON c.parent_id = t.id
  )
`;

export const CategoryRepository = {
  findAll: async () => {
    const result = await pool.query(
      "SELECT * FROM categories ORDER BY parent_id NULLS FIRST, name",
    );
    return result.rows;
  },

  findFlat: async (): Promise<FlatCategory[]> => {
    const { rows } = await pool.query(`
      ${TREE}
      SELECT t.id, t.name, t.kind, t.parent_id, p.name AS parent_name,
             t.root_id, t.root_name, t.depth, t.path,
             NOT EXISTS (SELECT 1 FROM categories ch WHERE ch.parent_id = t.id) AS is_leaf,
             (SELECT count(*) FROM transactions tx WHERE tx.category_id = t.id)::int
               AS transaction_count
      FROM tree t
      LEFT JOIN categories p ON p.id = t.parent_id
      ORDER BY t.path
    `);
    return rows;
  },

  create: async (
    name: string,
    parentId: number | null,
    requestedKind?: string,
  ) => {
    let kind: string;

    if (parentId === null) {
      // A new sector has no parent to inherit from, so it must declare whether
      // it is money in, money out, or movement between your own accounts.
      if (!requestedKind || !KINDS.includes(requestedKind)) {
        throw new Error(`A new sector needs a kind: ${KINDS.join(", ")}`);
      }
      kind = requestedKind;
    } else {
      const { rows: parent } = await pool.query(
        `${TREE} SELECT kind, depth FROM tree WHERE id = $1`,
        [parentId],
      );
      if (parent.length === 0) throw new Error("Parent category not found");
      if (parent[0].depth >= MAX_DEPTH) {
        throw new Error(`Categories can only nest ${MAX_DEPTH} levels deep`);
      }
      // Kind is inherited so a child can never contradict its sector.
      kind = parent[0].kind;
    }

    const { rows } = await pool.query(
      `INSERT INTO categories (name, parent_id, kind) VALUES ($1, $2, $3)
       RETURNING id, name, parent_id, kind`,
      [name.trim(), parentId, kind],
    );
    return rows[0];
  },

  rename: async (id: number, name: string) => {
    const { rows } = await pool.query(
      "UPDATE categories SET name = $2 WHERE id = $1 RETURNING id, name, parent_id, kind",
      [id, name.trim()],
    );
    if (rows.length === 0) throw new Error("Category not found");
    return rows[0];
  },

  /**
   * Deletes a category, moving anything filed against it to its parent rather
   * than orphaning the transactions. A root has nowhere to move them to.
   */
  remove: async (id: number) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows: target } = await client.query(
        "SELECT parent_id FROM categories WHERE id = $1",
        [id],
      );
      if (target.length === 0) throw new Error("Category not found");

      const { rows: children } = await client.query(
        "SELECT count(*)::int AS n FROM categories WHERE parent_id = $1",
        [id],
      );
      if (children[0].n > 0) {
        throw new Error(
          "Delete or move the sub-categories first, so nothing is silently reparented.",
        );
      }

      const parentId = target[0].parent_id;
      const { rowCount } = await client.query(
        "UPDATE transactions SET category_id = $2 WHERE category_id = $1",
        [id, parentId],
      );

      await client.query("DELETE FROM categories WHERE id = $1", [id]);
      await client.query("COMMIT");
      return { reassigned: rowCount ?? 0, moved_to: parentId };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
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
