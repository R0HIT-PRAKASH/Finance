exports.up = (pgm) => {
  // Statements identify themselves by account number, so imports can route
  // without asking which account a file belongs to.
  pgm.addColumns("accounts", {
    account_number: { type: "varchar(50)", notNull: false },
  });
  pgm.addConstraint("accounts", "accounts_account_number_unique", {
    unique: ["account_number"],
  });

  pgm.sql(`
    UPDATE accounts SET account_number = v.num FROM (VALUES
      ('TFSA',           'BMO Investorline', '22883310'),
      ('FHSA',           'BMO Investorline', '23802741'),
      ('RRSP',           'BMO Investorline', '21867136'),
      ('Non-Registered', 'BMO Investorline', '23904403')
    ) AS v(name, institution, num)
    WHERE accounts.name = v.name AND accounts.institution = v.institution
  `);

  // Flows, as opposed to holdings which are positions. Never used to derive a
  // position: the ledger may start after the account did, so a snapshot stays
  // authoritative and these apply forward from it.
  pgm.createTable("investment_activity", {
    id: "id",
    date: { type: "date", notNull: true },
    settlement_date: { type: "date", notNull: false },
    account_id: {
      type: "integer",
      notNull: true,
      references: "accounts",
      onDelete: "CASCADE",
    },
    activity_type: { type: "varchar(30)", notNull: true },
    /** The broker's own wording, kept so normalization stays auditable. */
    raw_activity: { type: "varchar(100)", notNull: true },
    description: { type: "text" },
    security: { type: "varchar(100)" },
    quantity: { type: "numeric(20,6)" },
    price: { type: "numeric(20,6)" },
    price_currency: { type: "varchar(10)" },
    amount: { type: "numeric(20,6)", notNull: true },
    currency: { type: "varchar(10)", notNull: true, default: "CAD" },
    /** Same duplicate handling as transactions: sources give a date, not a time. */
    occurrence: { type: "smallint", notNull: true, default: 1 },
    created_at: { type: "timestamptz", default: pgm.func("now()") },
  });

  pgm.addConstraint("investment_activity", "investment_activity_natural_key_unique", {
    unique: [
      "account_id",
      "date",
      "raw_activity",
      "description",
      "quantity",
      "amount",
      "occurrence",
    ],
  });
  pgm.createIndex("investment_activity", "date");
  pgm.createIndex("investment_activity", ["account_id", "date"]);
  pgm.createIndex("investment_activity", "security");
};

exports.down = (pgm) => {
  pgm.dropTable("investment_activity");
  pgm.dropConstraint("accounts", "accounts_account_number_unique");
  pgm.dropColumns("accounts", ["account_number"]);
};
