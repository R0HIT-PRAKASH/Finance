exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO categories (name, parent_id, kind)
    SELECT 'Phone', id, kind FROM categories WHERE name = 'Housing'
    AND NOT EXISTS (
      SELECT 1 FROM categories c
      JOIN categories p ON p.id = c.parent_id
      WHERE c.name = 'Phone' AND p.name = 'Housing'
    )
  `);

  // These sat on the 'Living Expenses' parent only because no leaf fit them.
  pgm.sql(`
    UPDATE transactions SET category_id = (
      SELECT c.id FROM categories c
      JOIN categories p ON p.id = c.parent_id
      WHERE c.name = 'Phone' AND p.name = 'Housing'
    )
    WHERE description ~* 'FIDO|PUBLIC MOBILE'
      AND category_id = (SELECT id FROM categories WHERE name = 'Living Expenses')
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    UPDATE transactions SET category_id = (
      SELECT id FROM categories WHERE name = 'Living Expenses'
    )
    WHERE category_id IN (
      SELECT c.id FROM categories c
      JOIN categories p ON p.id = c.parent_id
      WHERE c.name = 'Phone' AND p.name = 'Housing'
    )
  `);
  pgm.sql(`
    DELETE FROM categories c
    USING categories p
    WHERE c.parent_id = p.id AND c.name = 'Phone' AND p.name = 'Housing'
  `);
};
