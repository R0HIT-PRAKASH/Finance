import { ParsedTransaction } from "./bmo-chequing.parser";
import { parseAmount, parseCsvRows } from "./csv";

/**
 * BMO's credit card export is not the chequing format: it carries an item
 * number and a posting date, so the amount and description sit two columns
 * further right. Feeding it to the chequing parser reads the posting date as
 * the amount.
 *
 * Item #, Card #, Transaction Date, Posting Date, Transaction Amount, Description
 */
export function parseBMOCredit(content: string): ParsedTransaction[] {
  return parseCsvRows(content).flatMap((cols) => {
    if (cols.length < 6) return [];

    const rawDate = cols[2];
    if (!/^\d{8}$/.test(rawDate)) return [];

    const amount = parseAmount(cols[4]);
    if (amount === null) return [];

    return [
      {
        date: `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`,
        // Positive is a charge here, so negate to match the app's convention
        // that money leaving is negative.
        amount: -amount,
        description: cols[5].replace(/\s+/g, " ").trim(),
      },
    ];
  });
}
