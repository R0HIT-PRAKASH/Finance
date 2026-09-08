exports.up = (pgm) => {
  // A benchmark is priced like anything else, so it lives in securities and
  // reuses the prices table. Portfolio queries join through holdings, so it
  // never appears as a position.
  pgm.addColumns("securities", {
    is_benchmark: { type: "boolean", notNull: true, default: false },
  });

  // CAD listed and unhedged, so it carries the same USD exposure a Canadian
  // investor actually gets. The index in USD would flatter or punish the
  // comparison purely on currency.
  pgm.sql(`
    INSERT INTO securities (symbol, description, asset_class, sector, currency, ticker, is_benchmark)
    VALUES ('VFV.TO', 'Vanguard S&P 500 Index ETF (CAD)', 'Equity', 'Benchmark', 'CAD', 'VFV.TO', true)
    ON CONFLICT (symbol) DO UPDATE SET is_benchmark = true
  `);
};

exports.down = (pgm) => {
  pgm.sql("DELETE FROM securities WHERE is_benchmark = true");
  pgm.dropColumns("securities", ["is_benchmark"]);
};
