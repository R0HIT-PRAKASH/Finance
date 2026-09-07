exports.up = (pgm) => {
  // Sources give a date but never a time, so two genuinely separate identical
  // purchases on one day are indistinguishable. Numbering duplicates within a
  // source file makes re-importing an overlapping range idempotent while still
  // preserving real repeats: the same file always yields the same numbering.
  pgm.addColumns("transactions", {
    occurrence: { type: "smallint", notNull: true, default: 1 },
  });

  pgm.sql(`
    UPDATE transactions t SET occurrence = numbered.rn
    FROM (
      SELECT id, row_number() OVER (
        PARTITION BY account_id, date, amount, description ORDER BY id
      ) AS rn
      FROM transactions
    ) numbered
    WHERE t.id = numbered.id
  `);

  pgm.addConstraint("transactions", "transactions_natural_key_unique", {
    unique: ["account_id", "date", "amount", "description", "occurrence"],
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint("transactions", "transactions_natural_key_unique");
  pgm.dropColumns("transactions", ["occurrence"]);
};
