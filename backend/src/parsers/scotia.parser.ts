import { ParsedTransaction } from "./bmo-chequing.parser";
import { parseAmount, parseCsvRows } from "./csv";

const DATE = 1;
const DESCRIPTION = 2;
const SUB_DESCRIPTION = 3;
const AMOUNT = 6;

/**
 * Scotia leads each file with a filter description in the first column of the
 * first data row, so rows are identified by a parseable date rather than by
 * position.
 *
 * Filter, Date, Description, Sub-description, Status, Type of Transaction, Amount
 */
export function parseScotia(content: string): ParsedTransaction[] {
  return parseCsvRows(content).flatMap((cols) => {
    if (cols.length <= AMOUNT) return [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cols[DATE])) return [];

    const amount = parseAmount(cols[AMOUNT]);
    if (amount === null) return [];

    // Descriptions are space padded to a fixed width; the sub-description
    // carries the location when there is one.
    const description = [cols[DESCRIPTION], cols[SUB_DESCRIPTION]]
      .filter((p) => p && p.trim())
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    return [
      {
        date: cols[DATE],
        // Debits are positive charges and credits already carry a minus, so a
        // single negation puts both on the app's convention.
        amount: -amount,
        description,
      },
    ];
  });
}
