exports.up = (pgm) => {
  // The statement's symbol is not the quote symbol: MU:CA is MU.TO (44.60),
  // while MU.NE is a different listing of the same CDR at a different price.
  // Null means no public quote exists (e.g. institutional group-plan funds).
  pgm.addColumns("securities", {
    ticker: { type: "varchar(50)", notNull: false },
  });

  pgm.addColumns("prices", {
    source: { type: "varchar(20)", notNull: true, default: "statement" },
  });

  const tickers = {
    "GOOG:US": "GOOG",
    "ZEB:CA": "ZEB.TO",
    "ZQQ:CA": "ZQQ.TO",
    "XEF:CA": "XEF.TO",
    "XEC:CA": "XEC.TO",
    "XEQT:CA": "XEQT.TO",
    "XDG:CA": "XDG.TO",
    "CIF:CA": "CIF.TO",
    "XCHP:CA": "XCHP.TO",
    "MU:CA": "MU.TO",
    "SNDK:CA": "SNDK.TO",
  };

  for (const [symbol, ticker] of Object.entries(tickers)) {
    pgm.sql(
      `UPDATE securities SET ticker = '${ticker}' WHERE symbol = '${symbol}'`,
    );
  }
};

exports.down = (pgm) => {
  pgm.dropColumns("prices", ["source"]);
  pgm.dropColumns("securities", ["ticker"]);
};
