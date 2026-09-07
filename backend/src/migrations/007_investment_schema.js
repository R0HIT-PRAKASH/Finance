exports.up = (pgm) => {
  // Facts about a security itself, shared across every account that holds it.
  pgm.createTable("securities", {
    symbol: { type: "varchar(100)", primaryKey: true },
    description: { type: "varchar(255)" },
    asset_class: { type: "varchar(50)" },
    sector: { type: "varchar(100)" },
    currency: { type: "varchar(10)", notNull: true, default: "CAD" },
    created_at: { type: "timestamptz", default: pgm.func("now()") },
  });

  // Market data varies by date, so it stays on prices rather than securities.
  pgm.addColumns("prices", {
    previous_close: { type: "numeric(20,6)" },
    dividend_yield: { type: "numeric(10,4)" },
    annual_dividend: { type: "numeric(20,6)" },
    dividend_frequency: { type: "varchar(20)" },
    ex_dividend_date: { type: "date" },
    beta: { type: "numeric(10,4)" },
    pe_ratio: { type: "numeric(12,4)" },
    eps: { type: "numeric(12,4)" },
  });

  // The initial schema created these twice; duplicates make ON CONFLICT
  // arbiter inference ambiguous for the importer.
  pgm.dropConstraint("prices", "prices_date_security_currency_key");
  pgm.dropConstraint("exchange_rates", "exchange_rates_date_from_currency_to_currency_key");

  pgm.renameColumn("holdings", "currency", "settlement_currency");
  pgm.addColumns("holdings", {
    // Cost columns are in the holding's settlement currency, not CAD.
    average_cost: { type: "numeric(20,6)" },
    total_cost: { type: "numeric(20,6)" },
    // The broker reports these already converted to CAD.
    market_value_cad: { type: "numeric(20,6)" },
    unrealized_gain_cad: { type: "numeric(20,6)" },
  });

  // The broker derives unrealized gain from a CAD cost base built with
  // purchase-date FX, so backing it out recovers the tax-correct ACB.
  pgm.sql(`
    ALTER TABLE holdings
    ADD COLUMN book_value_cad numeric(20,6)
    GENERATED ALWAYS AS (market_value_cad - unrealized_gain_cad) STORED
  `);

  pgm.addConstraint("holdings", "holdings_date_account_security_unique", {
    unique: ["date", "account_id", "security"],
  });
  pgm.createIndex("holdings", "date");
  pgm.createIndex("holdings", "account_id");

  // Uninvested cash is part of an account's value but isn't a security.
  pgm.createTable("account_cash", {
    id: "id",
    date: { type: "date", notNull: true },
    account_id: {
      type: "integer",
      notNull: true,
      references: "accounts",
      onDelete: "CASCADE",
    },
    currency: { type: "varchar(10)", notNull: true },
    amount: { type: "numeric(20,6)", notNull: true },
    created_at: { type: "timestamptz", default: pgm.func("now()") },
  });
  pgm.addConstraint("account_cash", "account_cash_date_account_currency_unique", {
    unique: ["date", "account_id", "currency"],
  });
};

exports.down = (pgm) => {
  pgm.dropTable("account_cash");
  pgm.dropIndex("holdings", "account_id");
  pgm.dropIndex("holdings", "date");
  pgm.dropConstraint("holdings", "holdings_date_account_security_unique");
  pgm.dropColumns("holdings", [
    "book_value_cad",
    "average_cost",
    "total_cost",
    "market_value_cad",
    "unrealized_gain_cad",
  ]);
  pgm.renameColumn("holdings", "settlement_currency", "currency");
  pgm.addConstraint("prices", "prices_date_security_currency_key", {
    unique: ["date", "security", "currency"],
  });
  pgm.addConstraint("exchange_rates", "exchange_rates_date_from_currency_to_currency_key", {
    unique: ["date", "from_currency", "to_currency"],
  });
  pgm.dropColumns("prices", [
    "previous_close",
    "dividend_yield",
    "annual_dividend",
    "dividend_frequency",
    "ex_dividend_date",
    "beta",
    "pe_ratio",
    "eps",
  ]);
  pgm.dropTable("securities");
};
