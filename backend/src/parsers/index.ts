import { parseBMOChequing } from "./bmo-chequing.parser";
import { parseAmex } from "./amex.parser";
import { ParsedTransaction } from "./bmo-chequing.parser";

export type { ParsedTransaction };

type ParserFn = (content: string) => ParsedTransaction[];

// Maps institution (lowercase) + type to parser
const PARSERS: Record<string, ParserFn> = {
  "bmo:chequing": parseBMOChequing,
  "bmo:savings": parseBMOChequing, // same format
  "amex:credit": parseAmex,
};

export function getParser(institution: string, type: string): ParserFn | null {
  const key = `${institution.toLowerCase().split(" ")[0]}:${type}`;
  return PARSERS[key] ?? null;
}
