exports.up = (pgm) => {
  pgm.addColumns("securities", {
    // A fund's own asset mix, which is finer than the statement's single label:
    // the statement calls every ETF "Equity" regardless of what it holds.
    stock_position: { type: "numeric(6,4)" },
    bond_position: { type: "numeric(6,4)" },
    cash_position: { type: "numeric(6,4)" },
    other_position: { type: "numeric(6,4)" },
    legal_type: { type: "varchar(60)" },
    // No reliable free source: Yahoo reports 0 for TSX ETFs and fund geography
    // comes from provider files. Fetched when a source exists, else set by hand.
    mer: { type: "numeric(6,4)" },
    region: { type: "varchar(60)" },
    metadata_updated_at: { type: "timestamptz" },
  });

  // Look-through weights: one row per sector a security is exposed to, so an
  // ETF's holdings can be attributed to real sectors instead of "Equity Funds".
  pgm.createTable("security_sector_weights", {
    id: "id",
    security: {
      type: "varchar(100)",
      notNull: true,
      references: "securities",
      onDelete: "CASCADE",
    },
    sector: { type: "varchar(60)", notNull: true },
    weight: { type: "numeric(6,4)", notNull: true },
  });
  pgm.addConstraint(
    "security_sector_weights",
    "security_sector_weights_unique",
    { unique: ["security", "sector"] },
  );
};

exports.down = (pgm) => {
  pgm.dropTable("security_sector_weights");
  pgm.dropColumns("securities", [
    "stock_position",
    "bond_position",
    "cash_position",
    "other_position",
    "legal_type",
    "mer",
    "region",
    "metadata_updated_at",
  ]);
};
