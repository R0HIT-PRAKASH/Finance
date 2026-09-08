exports.up = (pgm) => {
  // Group plans publish a period summary but no usable transaction ledger, so
  // this is the only route to contribution-versus-growth for those accounts.
  // Period data, not point in time, which is why it is not a holdings snapshot.
  pgm.createTable("plan_period_summary", {
    id: "id",
    account_id: {
      type: "integer",
      notNull: true,
      references: "accounts",
      onDelete: "CASCADE",
    },
    period_start: { type: "date", notNull: true },
    period_end: { type: "date", notNull: true },
    opening_value_cad: { type: "numeric(20,2)", notNull: true },
    contributions_cad: { type: "numeric(20,2)", notNull: true },
    market_change_cad: { type: "numeric(20,2)", notNull: true },
    closing_value_cad: { type: "numeric(20,2)", notNull: true },
    created_at: { type: "timestamptz", default: pgm.func("now()") },
  });

  pgm.addConstraint("plan_period_summary", "plan_period_summary_unique", {
    unique: ["account_id", "period_start", "period_end"],
  });
};

exports.down = (pgm) => {
  pgm.dropTable("plan_period_summary");
};
