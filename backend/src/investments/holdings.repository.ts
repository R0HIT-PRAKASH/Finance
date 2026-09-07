import pool from "../db/pool";
import { ParsedHoldingsReport } from "../parsers/investorline-holdings.parser";

export type HoldingsImportResult = {
  account: string;
  as_of: string;
  holdings: number;
  cash_rows: number;
  securities_added: number;
  securities_value_cad: number;
  cash_cad: number;
  total_cad: number;
};

/**
 * The statement symbol is not the quote symbol. This default is right for every
 * security seen so far, but it is only a starting guess: it is applied when a
 * security is first created and never overwrites an existing ticker, so a
 * manual correction sticks.
 */
function defaultTicker(symbol: string): string | null {
  if (symbol.endsWith(":CA")) return `${symbol.slice(0, -3)}.TO`;
  if (symbol.endsWith(":US")) return symbol.slice(0, -3);
  return null;
}

export const HoldingsRepository = {
  importReport: async (
    report: ParsedHoldingsReport,
  ): Promise<HoldingsImportResult> => {
    const { rows: accounts } = await pool.query(
      "SELECT id, name FROM accounts WHERE account_number = $1",
      [report.account_number],
    );
    if (accounts.length === 0) {
      throw new Error(
        `No account matches number ${report.account_number}. Link it first.`,
      );
    }
    const account = accounts[0];

    const securitiesValue = report.holdings.reduce(
      (t, h) => t + h.market_value_cad,
      0,
    );
    const cashCad = report.cash.reduce(
      (t, c) =>
        t + (c.currency === "CAD" ? c.amount : c.amount * (report.usd_to_cad ?? 1)),
      0,
    );
    const total = securitiesValue + cashCad;

    // Each row states its own inputs and outputs, so the parse is checked
    // against arithmetic the file itself asserts. Deriving an expected total
    // from a value under test would be circular and catch nothing.
    const off = (actual: number, expected: number) =>
      Math.abs(actual - expected) > Math.max(1, Math.abs(expected) * 0.005);

    for (const h of report.holdings) {
      if (h.average_cost !== null && h.total_cost !== null) {
        const expected = h.quantity * h.average_cost;
        if (off(h.total_cost, expected)) {
          throw new Error(
            `${h.symbol}: total cost ${h.total_cost} does not match ${h.quantity} x ${h.average_cost}`,
          );
        }
      }
      if (h.current_price !== null) {
        const fx =
          h.settlement_currency === "CAD" ? 1 : (report.usd_to_cad ?? 1);
        const expected = h.quantity * h.current_price * fx;
        if (off(h.market_value_cad, expected)) {
          throw new Error(
            `${h.symbol}: market value ${h.market_value_cad} does not match ${h.quantity} x ${h.current_price} x ${fx}`,
          );
        }
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let securitiesAdded = 0;

      for (const h of report.holdings) {
        const inserted = await client.query(
          `INSERT INTO securities (symbol, description, asset_class, sector, currency, ticker)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (symbol) DO UPDATE
           SET description = EXCLUDED.description,
               asset_class = EXCLUDED.asset_class,
               sector = EXCLUDED.sector
           RETURNING (xmax = 0) AS created`,
          [
            h.symbol,
            h.description,
            h.asset_class,
            h.sector,
            h.settlement_currency,
            defaultTicker(h.symbol),
          ],
        );
        if (inserted.rows[0]?.created) securitiesAdded += 1;

        if (h.current_price !== null) {
          await client.query(
            `INSERT INTO prices (date, security, price, currency, source, previous_close,
                                 dividend_yield, annual_dividend, dividend_frequency,
                                 ex_dividend_date, beta, pe_ratio, eps)
             VALUES ($1,$2,$3,$4,'statement',$5,$6,$7,$8,$9,$10,$11,$12)
             ON CONFLICT (date, security, currency) DO UPDATE
             SET price = EXCLUDED.price, source = 'statement',
                 previous_close = EXCLUDED.previous_close,
                 dividend_yield = EXCLUDED.dividend_yield,
                 annual_dividend = EXCLUDED.annual_dividend,
                 dividend_frequency = EXCLUDED.dividend_frequency,
                 ex_dividend_date = EXCLUDED.ex_dividend_date,
                 beta = EXCLUDED.beta, pe_ratio = EXCLUDED.pe_ratio, eps = EXCLUDED.eps`,
            [
              report.as_of, h.symbol, h.current_price, h.settlement_currency,
              h.previous_close, h.dividend_yield, h.annual_dividend,
              h.dividend_frequency, h.ex_dividend_date, h.beta, h.pe_ratio, h.eps,
            ],
          );
        }

        await client.query(
          `INSERT INTO holdings (date, account_id, security, units, settlement_currency,
                                 average_cost, total_cost, market_value_cad, unrealized_gain_cad)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (date, account_id, security) DO UPDATE
           SET units = EXCLUDED.units,
               settlement_currency = EXCLUDED.settlement_currency,
               average_cost = EXCLUDED.average_cost,
               total_cost = EXCLUDED.total_cost,
               market_value_cad = EXCLUDED.market_value_cad,
               unrealized_gain_cad = EXCLUDED.unrealized_gain_cad`,
          [
            report.as_of, account.id, h.symbol, h.quantity, h.settlement_currency,
            h.average_cost, h.total_cost, h.market_value_cad, h.unrealized_gain_cad,
          ],
        );
      }

      for (const c of report.cash) {
        await client.query(
          `INSERT INTO account_cash (date, account_id, currency, amount)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (date, account_id, currency) DO UPDATE
           SET amount = EXCLUDED.amount`,
          [report.as_of, account.id, c.currency, c.amount],
        );
      }

      if (report.usd_to_cad) {
        await client.query(
          `INSERT INTO exchange_rates (date, from_currency, to_currency, rate)
           VALUES ($1,'USD','CAD',$2), ($1,'CAD','USD',$3)
           ON CONFLICT (date, from_currency, to_currency) DO UPDATE
           SET rate = EXCLUDED.rate`,
          [report.as_of, report.usd_to_cad, 1 / report.usd_to_cad],
        );
      }

      await client.query("COMMIT");
      return {
        account: account.name,
        as_of: report.as_of,
        holdings: report.holdings.length,
        cash_rows: report.cash.length,
        securities_added: securitiesAdded,
        securities_value_cad: securitiesValue,
        cash_cad: cashCad,
        total_cad: total,
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },
};
