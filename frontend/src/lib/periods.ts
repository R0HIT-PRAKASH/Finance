export type DateRange = { from?: string; to?: string };

/**
 * Formats from local calendar parts. Going via toISOString would shift the date
 * by a day for anyone in a positive UTC offset, since it converts local
 * midnight to UTC.
 */
function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `now` is injectable so the ranges can be tested against a fixed date. */
export function getPeriodDates(period: string, now = new Date()): DateRange {
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (period) {
    case "this_month":
      return {
        from: toISODate(new Date(y, m, 1)),
        to: toISODate(new Date(y, m + 1, 0)),
      };
    case "last_month":
      return {
        from: toISODate(new Date(y, m - 1, 1)),
        to: toISODate(new Date(y, m, 0)),
      };
    case "last_3_months":
      return { from: toISODate(new Date(y, m - 2, 1)) };
    case "last_6_months":
      return { from: toISODate(new Date(y, m - 5, 1)) };
    case "this_year":
      return { from: `${y}-01-01` };
    default:
      return {};
  }
}
