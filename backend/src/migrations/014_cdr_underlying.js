exports.up = (pgm) => {
  // A CDR is a CAD-hedged wrapper around a foreign listing. The wrapper itself
  // carries almost no profile data, but the underlying carries all of it, so
  // exposure should be attributed by what the CDR actually tracks.
  pgm.addColumns("securities", {
    underlying_ticker: { type: "varchar(50)" },
  });

  pgm.sql(`
    UPDATE securities SET underlying_ticker = v.underlying FROM (VALUES
      ('MU:CA',   'MU'),
      ('SNDK:CA', 'SNDK')
    ) AS v(symbol, underlying)
    WHERE securities.symbol = v.symbol
  `);
};

exports.down = (pgm) => {
  pgm.dropColumns("securities", ["underlying_ticker"]);
};
