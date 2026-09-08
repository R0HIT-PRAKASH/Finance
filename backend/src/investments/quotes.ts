import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const BOC_USDCAD =
  "https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=1";

export type Quote = {
  ticker: string;
  price: number;
  currency: string;
  /** Exchange-reported date of the quote, not the time we fetched it. */
  quote_date: string;
};

export type FxRate = {
  from_currency: string;
  to_currency: string;
  rate: number;
  date: string;
};

/**
 * Quotes come from Yahoo's unofficial API, which has no SLA and breaks
 * periodically. Callers must treat this as best-effort: an empty or partial
 * result is normal and must never invalidate stored statement values.
 */
export async function fetchQuotes(tickers: string[]): Promise<Quote[]> {
  if (tickers.length === 0) return [];

  const results: any = await yf.quote(tickers);
  const rows = Array.isArray(results) ? results : [results];

  return rows.flatMap((q) => {
    if (typeof q?.regularMarketPrice !== "number" || !q.symbol) return [];
    const time = q.regularMarketTime
      ? new Date(q.regularMarketTime)
      : new Date();
    return [
      {
        ticker: q.symbol,
        price: q.regularMarketPrice,
        currency: q.currency ?? "CAD",
        quote_date: time.toISOString().slice(0, 10),
      },
    ];
  });
}

export type HistoricalBar = {
  ticker: string;
  date: string;
  close: number;
  currency: string;
};

/**
 * Daily closes for one ticker. Used to value past positions, so the whole
 * series is returned rather than a single point.
 */
export async function fetchHistory(
  ticker: string,
  from: string,
  to: string,
): Promise<HistoricalBar[]> {
  const result: any = await yf.chart(ticker, {
    period1: from,
    period2: to,
    interval: "1d",
  });
  const currency = result?.meta?.currency ?? "CAD";

  return (result?.quotes ?? []).flatMap((q: any) =>
    typeof q?.close === "number" && q?.date
      ? [
          {
            ticker,
            date: new Date(q.date).toISOString().slice(0, 10),
            close: q.close,
            currency,
          },
        ]
      : [],
  );
}

/** Bank of Canada's official rate. No API key, unlike the quote feed. */
export async function fetchUsdCad(): Promise<FxRate | null> {
  const res = await fetch(BOC_USDCAD);
  if (!res.ok) return null;

  const body: any = await res.json();
  const observation = body?.observations?.[0];
  const rate = Number(observation?.FXUSDCAD?.v);
  if (!observation?.d || !Number.isFinite(rate)) return null;

  return {
    from_currency: "USD",
    to_currency: "CAD",
    rate,
    date: observation.d,
  };
}
