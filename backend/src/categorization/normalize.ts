// Multi-word entries must be listed before any single-word prefix they share.
const CITIES = [
  "NORTH YORK",
  "NORTH VANCOUVER",
  "WEST VANCOUVER",
  "NEW WESTMINSTER",
  "THUNDER BAY",
  "QUEBEC CITY",
  "ST JOHNS",
  "VANCOUVER",
  "TORONTO",
  "MONTREAL",
  "CALGARY",
  "EDMONTON",
  "OTTAWA",
  "WINNIPEG",
  "MISSISSAUGA",
  "BRAMPTON",
  "HAMILTON",
  "SURREY",
  "BURNABY",
  "RICHMOND",
  "VICTORIA",
  "HALIFAX",
  "SASKATOON",
  "REGINA",
  "KELOWNA",
  "WATERLOO",
  "KITCHENER",
  "WINDSOR",
  "OSHAWA",
  "BARRIE",
  "GUELPH",
  "MARKHAM",
  "VAUGHAN",
  "SCARBOROUGH",
  "ETOBICOKE",
  "LAVAL",
  "GATINEAU",
  "COQUITLAM",
  "LANGLEY",
  "ABBOTSFORD",
];

const REGIONS = new Set([
  "BC", "AB", "SK", "MB", "ON", "QC", "NB", "NS", "PE", "NL", "YT", "NT", "NU",
  "CAN", "CA", "USA", "US",
]);

const DAYS = new Set(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);

function isNoiseToken(token: string): boolean {
  if (DAYS.has(token)) return true;
  if (/^#\d+/.test(token)) return true; // store number: #5795
  if (/\*{2,}/.test(token)) return true; // masked card: ******9005
  if (/^\d{1,2}(AM|PM)$/.test(token)) return true; // time: 1AM
  if (/^\d{4,}$/.test(token)) return true; // long number: 2390440317
  if (/^(?=.*\d)[A-Z0-9-]{6,}$/.test(token)) return true; // ref code: RTCT0000051951, 888-481-3436
  return false;
}

const PERSON_TRANSFER_MARKERS = ["INTERAC ETRNSFR", "INTERAC E-TRANSFER"];

/**
 * True for money moved to or from another person. The counterparty is stable but
 * the purpose is not — the same person may send rent one month and split dinner
 * the next — so these can never be categorized in bulk or turned into a rule.
 */
export function isPersonTransfer(description: string): boolean {
  const upper = description.toUpperCase();
  return PERSON_TRANSFER_MARKERS.some((m) => upper.includes(m));
}

/**
 * Derives a grouping key by truncating a description at its first noise token.
 * Truncating (rather than filtering noise out of the middle) guarantees the key
 * is a contiguous substring of the original, so it works directly as a LIKE
 * pattern for merchant rules.
 */
export function normalizeDescription(description: string): string {
  const cleaned = description
    .toUpperCase()
    .replace(/^\[[A-Z]{2}\]/, "") // strip [PR] / [DN] / [CW] type prefix
    .replace(/\s+/g, " ")
    .trim();

  const tokens = cleaned.split(" ").filter(Boolean);
  const kept: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    // A place name in first position is part of the merchant ("BC HYDRO"),
    // not a location suffix — only treat it as noise once something is kept.
    if (kept.length > 0) {
      const twoWord = `${tokens[i]} ${tokens[i + 1] ?? ""}`;
      if (CITIES.includes(twoWord)) break;
      if (CITIES.includes(tokens[i])) break;
      if (REGIONS.has(tokens[i])) break;
    }
    if (isNoiseToken(tokens[i])) break;

    kept.push(tokens[i]);
  }

  const key = kept.join(" ").trim();
  if (key.length < 2) {
    const prefix = description.match(/^\[([A-Z]{2})\]/)?.[1];
    return prefix ?? "OTHER";
  }
  return key;
}
