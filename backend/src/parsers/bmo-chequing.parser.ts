export type ParsedTransaction = {
  date: string;
  amount: number;
  description: string;
};

export function parseBMOChequing(content: string): ParsedTransaction[] {
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return lines
    .slice(1)
    .filter((line) => {
      const cols = line.match(/('.*?'|[^,]+)/g)?.map((c) => c.trim()) ?? [];
      return /^\d{8}$/.test(cols[2]);
    })
    .map((line) => {
      const cols = line.match(/('.*?'|[^,]+)/g)?.map((c) => c.trim()) ?? [];
      const rawDate = cols[2];
      const amount = parseFloat(cols[3]);
      const description = cols[4]?.replace(/\s+/g, " ").trim() ?? "";
      const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
      return { date, amount, description };
    });
}
