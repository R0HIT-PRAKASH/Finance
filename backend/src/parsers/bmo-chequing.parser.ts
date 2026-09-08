export type ParsedTransaction = {
  date: string;
  amount: number;
  description: string;
};

/** BMO quotes some columns, and the quotes are not part of the value. */
function splitColumns(line: string): string[] {
  return (line.match(/('.*?'|[^,]+)/g) ?? []).map((c) =>
    c.trim().replace(/^'(.*)'$/, "$1"),
  );
}

export function parseBMOChequing(content: string): ParsedTransaction[] {
  // Both BMO exports open with the same "Following data is valid as of" line,
  // but the credit layout shifts amount and description one column right. Left
  // undetected it reads the posting date as the amount, which is silently wrong
  // rather than obviously broken.
  if (/^\s*Item\s*#\s*,/m.test(content)) {
    throw new Error(
      "This is a BMO credit card export, not a chequing one. Import it against the credit card account.",
    );
  }

  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return lines
    .slice(1)
    .filter((line) => /^\d{8}$/.test(splitColumns(line)[2]))
    .map((line) => {
      const cols = splitColumns(line);
      const rawDate = cols[2];
      const amount = parseFloat(cols[3]);
      const description = cols[4]?.replace(/\s+/g, " ").trim() ?? "";
      const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
      return { date, amount, description };
    });
}
