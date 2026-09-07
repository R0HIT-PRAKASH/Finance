import { ParsedTransaction } from "./bmo-chequing.parser";

function parseAmexDate(raw: string): string {
  const months: Record<string, string> = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };
  const parts = raw.trim().split(" ");
  const day = parts[0].padStart(2, "0");
  const month = months[parts[1]];
  const year = parts[2];
  return `${year}-${month}-${day}`;
}

export function parseAmex(content: string): ParsedTransaction[] {
  // Amex CSVs can have newlines inside quoted fields (e.g. "VANCOUVER\nBC")
  // We need to properly parse quoted CSV
  const results: ParsedTransaction[] = [];

  // Split into rows respecting quoted fields
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch === '"' || ch === "'") {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      current.push(field.trim());
      field = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (field.trim() || current.length > 0) {
        current.push(field.trim());
        if (current.some((c) => c.length > 0)) {
          rows.push(current);
        }
        current = [];
        field = "";
      }
    } else {
      field += ch;
    }
  }
  // Push last row
  if (current.length > 0) {
    current.push(field.trim());
    rows.push(current);
  }

  // Skip header row
  const dataRows = rows.slice(1);

  for (const cols of dataRows) {
    if (cols.length < 4) continue;

    const rawDate = cols[0];
    const description = cols[2]?.replace(/\s+/g, " ").trim() ?? "";
    const rawAmount = cols[3];

    if (!rawDate || !rawAmount) continue;

    // Skip if date doesn't look right
    if (!rawDate.match(/\d{1,2} \w{3} \d{4}/)) continue;

    const amount = parseFloat(rawAmount);
    if (isNaN(amount)) continue;

    // Amex: positive = charge (money out), so we negate
    const date = parseAmexDate(rawDate);

    results.push({ date, amount: -amount, description });
  }

  return results;
}
