/**
 * Splits a CSV into rows of fields, honouring quoted fields that contain
 * commas or newlines. Bank exports embed both: Amex wraps addresses across
 * lines, and several issuers quote reference numbers.
 */
export function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const endField = () => {
    row.push(field.trim());
    field = "";
  };
  const endRow = () => {
    endField();
    if (row.some((f) => f.length > 0)) rows.push(row);
    row = [];
  };

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch === '"' || ch === "'") {
      // A doubled quote inside a quoted field is an escaped quote, not a close.
      if (inQuotes && content[i + 1] === ch) {
        field += ch;
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      endField();
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (field.length > 0 || row.length > 0) endRow();
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) endRow();

  return rows;
}

/** Parses "$8.54", "-$490.07" and "1,234.56" alike. */
export function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  const negative = raw.trim().startsWith("-");
  const digits = raw.replace(/[^0-9.]/g, "");
  if (digits === "") return null;
  const value = Number(digits);
  return Number.isFinite(value) ? (negative ? -value : value) : null;
}
