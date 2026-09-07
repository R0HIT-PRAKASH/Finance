exports.up = (pgm) => {
  pgm.addColumns("categories", {
    kind: { type: "varchar(20)", notNull: false },
  });

  // Roots define the kind; every descendant inherits it.
  pgm.sql(`
    WITH RECURSIVE roots AS (
      SELECT id,
        CASE name
          WHEN 'Income' THEN 'income'
          WHEN 'Transfers' THEN 'transfer'
          WHEN 'Investments' THEN 'transfer'
          ELSE 'expense'
        END AS kind
      FROM categories WHERE parent_id IS NULL
    ),
    tree AS (
      SELECT id, kind FROM roots
      UNION ALL
      SELECT c.id, t.kind FROM categories c JOIN tree t ON c.parent_id = t.id
    )
    UPDATE categories SET kind = tree.kind FROM tree WHERE categories.id = tree.id
  `);

  pgm.alterColumn("categories", "kind", { notNull: true });
  pgm.addConstraint(
    "categories",
    "categories_kind_check",
    "CHECK (kind IN ('income', 'expense', 'transfer'))",
  );

  // Both sides of a matched transfer share this id, so the pair reads as one movement.
  pgm.addColumns("transactions", {
    transfer_pair_id: { type: "integer", notNull: false },
  });
  pgm.createIndex("transactions", "transfer_pair_id");
};

exports.down = (pgm) => {
  pgm.dropIndex("transactions", "transfer_pair_id");
  pgm.dropColumns("transactions", ["transfer_pair_id"]);
  pgm.dropConstraint("categories", "categories_kind_check");
  pgm.dropColumns("categories", ["kind"]);
};
