import { parseBMOChequing } from "./bmo-chequing.parser";
import { parseBMOCredit } from "./bmo-credit.parser";
import { parseAmex } from "./amex.parser";
import { parseRogers } from "./rogers.parser";
import { parseScotia } from "./scotia.parser";
import { ParsedTransaction } from "./bmo-chequing.parser";

export type { ParsedTransaction };

type ParserFn = (content: string) => ParsedTransaction[];

// Keyed by the first word of the institution plus the account type. BMO's
// credit export is a different layout from its chequing one, so they cannot
// share a parser.
const PARSERS: Record<string, ParserFn> = {
  "bmo:chequing": parseBMOChequing,
  "bmo:savings": parseBMOChequing,
  "bmo:credit": parseBMOCredit,
  "amex:credit": parseAmex,
  "rogers:credit": parseRogers,
  "scotia:credit": parseScotia,
};

export function getParser(institution: string, type: string): ParserFn | null {
  const key = `${institution.toLowerCase().split(" ")[0]}:${type}`;
  return PARSERS[key] ?? null;
}
