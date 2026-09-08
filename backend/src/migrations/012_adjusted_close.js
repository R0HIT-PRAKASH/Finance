exports.up = (pgm) => {
  // Close values positions, because distributions this portfolio receives are
  // recorded separately as cash. Adjusted close assumes distributions are
  // reinvested, which is how an index's total return is stated, so it is what
  // the benchmark must be measured on. Comparing our total return against the
  // benchmark's price return would flatter us by the index's yield.
  pgm.addColumns("prices", {
    adj_close: { type: "numeric(20,6)", notNull: false },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns("prices", ["adj_close"]);
};
