import pool from "../db/pool";
import { fetchQuotes, fetchUsdCad } from "./quotes";

export type RefreshResult = {
  quoted: number;
  requested: number;
  /** Securities with no ticker, group-plan funds have no public quote. */
  unquotable: string[];
  failed: string[];
  fx_updated: boolean;
  fx_date: string | null;
};

export const PricesRepository = {
  refresh: async (): Promise<RefreshResult> => {
    const { rows: securities } = await pool.query(
      "SELECT symbol, ticker FROM securities ORDER BY symbol",
    );

    const quotable = securities.filter((s) => s.ticker);
    const unquotable = securities
      .filter((s) => !s.ticker)
      .map((s) => s.symbol);

    const bySymbol = new Map(quotable.map((s) => [s.ticker as string, s.symbol]));

    // A failing quote feed must leave stored statement values untouched.
    let quotes: Awaited<ReturnType<typeof fetchQuotes>> = [];
    try {
      quotes = await fetchQuotes(quotable.map((s) => s.ticker));
    } catch (err) {
      console.error("Quote fetch failed:", err);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (const quote of quotes) {
        const symbol = bySymbol.get(quote.ticker);
        if (!symbol) continue;
        await client.query(
          `INSERT INTO prices (date, security, price, currency, source)
           VALUES ($1, $2, $3, $4, 'market')
           ON CONFLICT (date, security, currency) DO UPDATE
           SET price = EXCLUDED.price, source = 'market'`,
          [quote.quote_date, symbol, quote.price, quote.currency],
        );
      }

      let fx = null;
      try {
        fx = await fetchUsdCad();
      } catch (err) {
        console.error("FX fetch failed:", err);
      }

      if (fx) {
        await client.query(
          `INSERT INTO exchange_rates (date, from_currency, to_currency, rate)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (date, from_currency, to_currency) DO UPDATE
           SET rate = EXCLUDED.rate`,
          [fx.date, fx.from_currency, fx.to_currency, fx.rate],
        );
        await client.query(
          `INSERT INTO exchange_rates (date, from_currency, to_currency, rate)
           VALUES ($1, 'CAD', 'USD', $2)
           ON CONFLICT (date, from_currency, to_currency) DO UPDATE
           SET rate = EXCLUDED.rate`,
          [fx.date, 1 / fx.rate],
        );
      }

      await client.query("COMMIT");

      const quotedTickers = new Set(quotes.map((q) => q.ticker));
      return {
        quoted: quotes.length,
        requested: quotable.length,
        unquotable,
        failed: quotable
          .filter((s) => !quotedTickers.has(s.ticker))
          .map((s) => s.symbol),
        fx_updated: fx !== null,
        fx_date: fx?.date ?? null,
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },
};
