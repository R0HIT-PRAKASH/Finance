export type Valuation = {
  date: string;
  /** Portfolio value at end of day, including cash. */
  value: number;
  /** Net external money added that day. Deposits positive, withdrawals negative. */
  flow: number;
};

export type CashFlow = { date: string; amount: number };

const DAYS_PER_YEAR = 365;

function daysBetween(a: string, b: string): number {
  return (Date.parse(b) - Date.parse(a)) / 86_400_000;
}

/**
 * Time-weighted return: the return of the investments themselves, with the
 * effect of deposit size and timing removed. This is the figure comparable to
 * an index, which is why funds report it.
 *
 * A flow lands at end of day and has not earned anything yet, so it is removed
 * from the closing value before the day's return is measured. Without that,
 * every deposit would register as a gain.
 */
export function timeWeightedReturn(valuations: Valuation[]): number | null {
  if (valuations.length < 2) return null;

  let compounded = 1;
  let measuredDays = 0;

  for (let i = 1; i < valuations.length; i++) {
    const previous = valuations[i - 1].value;
    const current = valuations[i];
    // A period that opens at zero has no capital at risk to earn a return on.
    if (previous <= 0) continue;
    compounded *= (current.value - current.flow) / previous;
    measuredDays += 1;
  }

  return measuredDays === 0 ? null : compounded - 1;
}

/**
 * Money-weighted return (XIRR): the annualised rate that discounts your actual
 * cash flows to zero. Unlike TWR this rewards or punishes deposit timing, so it
 * reflects your experience rather than the investments' performance.
 */
export function xirr(flows: CashFlow[]): number | null {
  if (flows.length < 2) return null;
  const hasPositive = flows.some((f) => f.amount > 0);
  const hasNegative = flows.some((f) => f.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  const start = flows[0].date;
  const npv = (rate: number): number =>
    flows.reduce((total, f) => {
      const years = daysBetween(start, f.date) / DAYS_PER_YEAR;
      return total + f.amount / Math.pow(1 + rate, years);
    }, 0);

  // Bisection rather than Newton: slower, but it cannot diverge on the awkward
  // flow patterns a real account produces.
  let low = -0.9999;
  let high = 10;
  if (npv(low) * npv(high) > 0) return null;

  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    const value = npv(mid);
    if (Math.abs(value) < 1e-7) return mid;
    if (npv(low) * value < 0) high = mid;
    else low = mid;
  }
  return (low + high) / 2;
}

/** Simple growth of a price series, used for the benchmark's total return. */
export function simpleReturn(first: number, last: number): number | null {
  return first > 0 ? last / first - 1 : null;
}
