import { ParsedTransaction } from "./bmo-chequing.parser";
import { parseAmount, parseCsvRows } from "./csv";

const DATE = 0;
const MERCHANT = 7;
const AMOUNT = 12;

/**
 * Rogers exports a wide row with the merchant already separated from the raw
 * descriptor, which is cleaner than most issuers.
 *
 * Date, Posted Date, Reference Number, Activity Type, Activity Status,
 * Card Number, Merchant Category Description, Merchant Name, City, Province,
 * Country, Postal Code, Amount, Rewards, Name on Card
 */
export function parseRogers(content: string): ParsedTransaction[] {
  return parseCsvRows(content).flatMap((cols) => {
    if (cols.length <= AMOUNT) return [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cols[DATE])) return [];

    const amount = parseAmount(cols[AMOUNT]);
    if (amount === null) return [];

    return [
      {
        date: cols[DATE],
        // "$8.54" is a charge and "-$490.07" a payment, so negate.
        amount: -amount,
        description: cols[MERCHANT].replace(/\s+/g, " ").trim(),
      },
    ];
  });
}
