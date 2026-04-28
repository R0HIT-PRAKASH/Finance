exports.up = (pgm) => {
  pgm.addColumns("accounts", {
    opening_balance: {
      type: "numeric(15,2)",
      notNull: true,
      default: 0,
    },
    opening_balance_date: {
      type: "date",
      notNull: false,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns("accounts", ["opening_balance", "opening_balance_date"]);
};
