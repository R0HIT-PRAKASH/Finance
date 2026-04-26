exports.up = (pgm) => {
  pgm.createTable(
    "accounts",
    {
      id: "id",
      name: { type: "varchar(255)", notNull: true },
      type: {
        type: "varchar(50)",
        notNull: true,
        check: "type IN ('investment', 'credit', 'chequing', 'savings')",
      },
      institution: { type: "varchar(255)", notNull: true },
      registered_type: {
        type: "varchar(50)",
        check:
          "registered_type IN ('TFSA', 'RRSP', 'FHSA', 'DPSP', 'Non-registered', 'none')",
      },
      currency: { type: "varchar(10)", notNull: true, default: "CAD" },
      created_at: { type: "timestamptz", default: pgm.func("now()") },
    },
    { ifNotExists: true },
  );

  pgm.createTable(
    "categories",
    {
      id: "id",
      name: { type: "varchar(255)", notNull: true },
      parent_id: {
        type: "integer",
        references: "categories(id)",
        onDelete: "SET NULL",
      },
      created_at: { type: "timestamptz", default: pgm.func("now()") },
    },
    { ifNotExists: true },
  );

  pgm.createTable(
    "transactions",
    {
      id: "id",
      date: { type: "date", notNull: true },
      account_id: {
        type: "integer",
        notNull: true,
        references: "accounts(id)",
        onDelete: "CASCADE",
      },
      amount: { type: "numeric(15,2)", notNull: true },
      currency: { type: "varchar(10)", notNull: true, default: "CAD" },
      merchant_name: { type: "varchar(255)" },
      description: { type: "text" },
      category_id: {
        type: "integer",
        references: "categories(id)",
        onDelete: "SET NULL",
      },
      categorization_source: {
        type: "varchar(20)",
        check: "categorization_source IN ('ai', 'rule', 'manual')",
      },
      categorization_confidence: {
        type: "varchar(10)",
        check: "categorization_confidence IN ('high', 'low')",
      },
      created_at: { type: "timestamptz", default: pgm.func("now()") },
    },
    { ifNotExists: true },
  );

  pgm.createTable(
    "holdings",
    {
      id: "id",
      date: { type: "date", notNull: true },
      account_id: {
        type: "integer",
        notNull: true,
        references: "accounts(id)",
        onDelete: "CASCADE",
      },
      security: { type: "varchar(100)", notNull: true },
      units: { type: "numeric(20,6)", notNull: true },
      currency: { type: "varchar(10)", notNull: true, default: "CAD" },
      created_at: { type: "timestamptz", default: pgm.func("now()") },
    },
    { ifNotExists: true },
  );

  pgm.createTable(
    "prices",
    {
      id: "id",
      date: { type: "date", notNull: true },
      security: { type: "varchar(100)", notNull: true },
      price: { type: "numeric(20,6)", notNull: true },
      currency: { type: "varchar(10)", notNull: true, default: "CAD" },
      created_at: { type: "timestamptz", default: pgm.func("now()") },
    },
    { ifNotExists: true },
  );

  pgm.addConstraint(
    "prices",
    "prices_date_security_currency_unique",
    "UNIQUE (date, security, currency)",
  );

  pgm.createTable(
    "exchange_rates",
    {
      id: "id",
      date: { type: "date", notNull: true },
      from_currency: { type: "varchar(10)", notNull: true },
      to_currency: { type: "varchar(10)", notNull: true },
      rate: { type: "numeric(20,8)", notNull: true },
      created_at: { type: "timestamptz", default: pgm.func("now()") },
    },
    { ifNotExists: true },
  );

  pgm.addConstraint(
    "exchange_rates",
    "exchange_rates_date_currencies_unique",
    "UNIQUE (date, from_currency, to_currency)",
  );

  pgm.createTable(
    "merchant_rules",
    {
      id: "id",
      merchant_name: { type: "varchar(255)", notNull: true, unique: true },
      category_id: {
        type: "integer",
        notNull: true,
        references: "categories(id)",
        onDelete: "CASCADE",
      },
      source: {
        type: "varchar(20)",
        notNull: true,
        check: "source IN ('ai', 'manual')",
      },
      created_at: { type: "timestamptz", default: pgm.func("now()") },
    },
    { ifNotExists: true },
  );

  pgm.createIndex("transactions", "account_id", {
    name: "idx_transactions_account_id",
    ifNotExists: true,
  });
  pgm.createIndex("transactions", "date", {
    name: "idx_transactions_date",
    ifNotExists: true,
  });
  pgm.createIndex("transactions", "category_id", {
    name: "idx_transactions_category_id",
    ifNotExists: true,
  });
  pgm.createIndex("holdings", "account_id", {
    name: "idx_holdings_account_id",
    ifNotExists: true,
  });
  pgm.createIndex("holdings", "date", {
    name: "idx_holdings_date",
    ifNotExists: true,
  });
  pgm.createIndex("prices", ["security", "date"], {
    name: "idx_prices_security_date",
    ifNotExists: true,
  });
  pgm.createIndex("exchange_rates", "date", {
    name: "idx_exchange_rates_date",
    ifNotExists: true,
  });
};

exports.down = (pgm) => {
  pgm.dropTable("merchant_rules", { cascade: true });
  pgm.dropTable("exchange_rates", { cascade: true });
  pgm.dropTable("prices", { cascade: true });
  pgm.dropTable("holdings", { cascade: true });
  pgm.dropTable("transactions", { cascade: true });
  pgm.dropTable("categories", { cascade: true });
  pgm.dropTable("accounts", { cascade: true });
};
