import pool from "../db/pool";
import { fetchHistory, fetchQuotes, fetchUsdCad } from "./quotes";

export type RefreshResult = {
  quoted: number;
  requested: number;
  /** Securities with no ticker, group-plan funds have no public quote. */
  unquotable: string[];
  failed: string[];
  fx_updated: boolean;
  fx_date: string | null;
};

export type BackfillResult = {
  from: string;
  to: string;
  securities: number;
  bars_written: number;
  failed: string[];
};

export const PricesRepository = {
  /**
   * Daily closes for every quotable security and benchmark. Statement prices
   * win on any date they exist for, since they are the authoritative record.
   */
  backfill: async (
    fromArg?: string,
    toArg?: string,
  ): Promise<BackfillResult> => {
    // Default to the span of recorded activity: earlier prices value nothing.
    const { rows: span } = await pool.query(
      "SELECT to_char(min(date),'YYYY-MM-DD') AS first FROM investment_activity",
    );
    const from = fromArg ?? span[0]?.first;
    if (!from) {
      throw new Error("No activity on file; pass an explicit from date");
    }
    const to = toArg ?? new Date().toISOString().slice(0, 10);

    const { rows: securities } = await pool.query(
      "SELECT symbol, ticker FROM securities WHERE ticker IS NOT NULL ORDER BY symbol",
    );

    const failed: string[] = [];
    let barsWritten = 0;

    for (const s of securities) {
      let bars: Awaited<ReturnType<typeof fetchHistory>> = [];
      try {
        bars = await fetchHistory(s.ticker, from, to);
      } catch (err) {
        console.error(`History failed for ${s.ticker}:`, err);
        failed.push(s.symbol);
        continue;
      }
      if (bars.length === 0) {
        failed.push(s.symbol);
        continue;
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const bar of bars) {
          const result = await client.query(
            `INSERT INTO prices (date, security, price, adj_close, currency, source)
             VALUES ($1, $2, $3, $4, $5, 'market')
             ON CONFLICT (date, security, currency) DO UPDATE
             SET price = EXCLUDED.price, adj_close = EXCLUDED.adj_close
             WHERE prices.source <> 'statement'`,
            [bar.date, s.symbol, bar.close, bar.adj_close, bar.currency],
          );
          barsWritten += result.rowCount ?? 0;
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }

    return {
      from,
      to,
      securities: securities.length - failed.length,
      bars_written: barsWritten,
      failed,
    };
  },

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
