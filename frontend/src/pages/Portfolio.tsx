import { useCallback, useEffect, useState } from "react";
import {
  api,
  ConsolidatedPosition,
  Exposure,
  PortfolioResponse,
  Slice,
} from "../api/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

function formatCAD(amount: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits,
  }).format(amount);
}

function GainText({ amount, pct }: { amount: number; pct: number }) {
  return (
    <span className={amount >= 0 ? "text-primary" : "text-destructive"}>
      {amount >= 0 ? "+" : ""}
      {formatCAD(amount)}{" "}
      <span className="text-xs">
        ({amount >= 0 ? "+" : ""}
        {pct.toFixed(2)}%)
      </span>
    </span>
  );
}

function Card({
  title,
  note,
  children,
  right,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="bg-muted border border-border rounded-xl mb-4">
      <div className="flex items-start justify-between px-5 py-4 border-b border-border">
        <div>
          <div className="text-sm font-medium text-foreground">{title}</div>
          {note && (
            <div className="text-xs text-muted-foreground mt-0.5">{note}</div>
          )}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

/** Horizontal bars, never pie: proportions are easier to compare on a shared baseline. */
function Breakdown({ rows }: { rows: Slice[] }) {
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between text-sm mb-1 gap-3">
            <span className="text-foreground truncate">{r.label}</span>
            <span className="font-mono text-muted-foreground text-xs whitespace-nowrap tabular-nums">
              {r.percentage.toFixed(1)}% · {formatCAD(r.value_cad, 0)}
            </span>
          </div>
          <div className="h-1 bg-background rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${r.percentage}%`,
                background: "var(--chart-value)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Portfolio() {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [exposure, setExposure] = useState<Exposure | null>(null);
  const [accountId, setAccountId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const scope = accountId ? parseInt(accountId) : undefined;

  const load = useCallback(
    () =>
      Promise.all([
        api.investments.portfolio(),
        api.investments.exposure(scope),
      ]).then(([p, e]) => {
        setData(p);
        setExposure(e);
      }),
    [scope],
  );

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    setNote(null);
    try {
      const r = await api.investments.refreshPrices();
      const parts = [`Priced ${r.quoted} of ${r.requested}`];
      if (r.failed.length) parts.push(`${r.failed.length} failed`);
      if (r.unquotable.length) parts.push(`${r.unquotable.length} have no quote`);
      if (r.fx_updated) parts.push(`FX ${r.fx_date}`);
      setNote(parts.join(" · "));
      await load();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }
  if (!data) return null;

  const { totals } = data;
  const funded = data.accounts.filter((a) => a.as_of !== null);
  const empty = data.accounts.filter((a) => a.as_of === null);
  const selected = scope
    ? funded.find((a) => a.account_id === scope)
    : undefined;

  // Everything below the selector reflects the chosen scope.
  const scopedValue = selected?.live_total_value_cad ?? totals.live_total_value_cad;
  const scopedBook = selected?.book_value_cad ?? totals.book_value_cad;
  const scopedGain = selected?.live_unrealized_cad ?? totals.live_unrealized_cad;
  const scopedPct = selected?.live_unrealized_pct ?? totals.live_unrealized_pct;
  const positions = scope
    ? (selected?.positions ?? []).map((p) => ({
        security: p.security,
        description: p.description,
        sector: p.sector,
        units: p.units,
        market_value_cad: p.live_value_cad ?? p.market_value_cad,
        book_value_cad: p.book_value_cad,
        unrealized_gain_cad: p.unrealized_gain_cad,
        unrealized_pct:
          p.book_value_cad && p.unrealized_gain_cad !== null
            ? (p.unrealized_gain_cad / p.book_value_cad) * 100
            : null,
        percentage: 0,
        held_in: [],
      }))
    : data.positions;

  const scopedTotal = positions.reduce((t, p) => t + p.market_value_cad, 0);
  const withShare = positions.map((p) => ({
    ...p,
    percentage: scope
      ? scopedTotal === 0
        ? 0
        : (p.market_value_cad / scopedTotal) * 100
      : p.percentage,
  }));

  const c = exposure?.concentration;

  return (
    <div>
      <div className="flex items-start justify-between mb-7 gap-4">
        <div>
          <h2 className="text-xl font-medium text-foreground">Portfolio</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {funded.length === 0
              ? "No holdings imported yet"
              : totals.oldest_price_date
                ? `Priced ${totals.oldest_price_date}`
                : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-52"
          >
            <option value="">All accounts</option>
            {funded.map((a) => (
              <option key={a.account_id} value={a.account_id}>
                {a.account_name} · {a.institution}
              </option>
            ))}
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh prices"}
          </Button>
        </div>
      </div>

      {note && (
        <div className="text-sm text-muted-foreground bg-muted border border-border rounded-lg px-4 py-3 mb-4">
          {note}
        </div>
      )}

      <div className="bg-muted border border-border rounded-xl p-6 mb-4">
        <div className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground mb-2">
          {selected ? selected.account_name : "Total value"}
        </div>
        <div className="text-4xl font-light font-mono text-foreground tracking-tight">
          {formatCAD(scopedValue)}
        </div>
        <div className="text-sm text-muted-foreground mt-3 flex flex-wrap gap-x-6 gap-y-1">
          {scopedBook !== null && <span>Book {formatCAD(scopedBook)}</span>}
          {scopedGain !== null && scopedPct !== null ? (
            <span>
              Unrealized <GainText amount={scopedGain} pct={scopedPct} />
            </span>
          ) : (
            <span>No cost basis on file</span>
          )}
          {exposure && exposure.income.annual_cad > 0 && (
            <span>
              Income {formatCAD(exposure.income.annual_cad, 0)}/yr (
              {exposure.income.yield_pct.toFixed(2)}%)
            </span>
          )}
        </div>
      </div>

      {c && c.top_position && (
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Metric
            label="Largest position"
            value={`${c.top_position.percentage.toFixed(1)}%`}
            hint={c.top_position.security}
          />
          <Metric
            label="Top five"
            value={`${c.top_five_pct.toFixed(1)}%`}
            hint={`of ${c.positions} positions`}
          />
          {c.largest_sector && (
            <Metric
              label="Largest sector"
              value={`${c.largest_sector.percentage.toFixed(1)}%`}
              hint={c.largest_sector.label}
            />
          )}
        </div>
      )}

      {!scope && funded.length > 0 && (
        <Card title="Accounts" note="Select one above to scope the page to it.">
          <table className="w-full">
            <tbody>
              {funded.map((a) => (
                <tr
                  key={a.account_id}
                  className="hover:bg-background/50 transition-colors cursor-pointer"
                  onClick={() => setAccountId(String(a.account_id))}
                >
                  <td className="px-5 py-3">
                    <div className="text-sm text-foreground">
                      {a.account_name}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {a.institution} · as of {a.as_of}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm font-mono text-right tabular-nums">
                    {formatCAD(a.live_total_value_cad)}
                  </td>
                  <td className="px-5 py-3 text-xs font-mono text-right whitespace-nowrap">
                    {a.live_unrealized_cad !== null &&
                    a.live_unrealized_pct !== null ? (
                      <GainText
                        amount={a.live_unrealized_cad}
                        pct={a.live_unrealized_pct}
                      />
                    ) : (
                      <span className="text-muted-foreground">no basis</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {exposure && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-muted border border-border rounded-xl p-5">
            <div className="text-sm font-medium text-foreground mb-1">
              Sector
            </div>
            <div className="text-xs text-muted-foreground mb-4">
              Seen through to what the funds hold, not the label on the
              statement.
            </div>
            <Breakdown rows={exposure.sectors.slice(0, 9)} />
            {exposure.securities_without_lookthrough.length > 0 && (
              <p className="text-xs text-muted-foreground mt-4">
                {exposure.securities_without_lookthrough.length} holdings have no
                look-through data and are counted whole under their own label.
              </p>
            )}
          </div>
          <div className="space-y-4">
            <div className="bg-muted border border-border rounded-xl p-5">
              <div className="text-sm font-medium text-foreground mb-4">
                Asset class
              </div>
              <Breakdown rows={exposure.asset_classes} />
            </div>
            <div className="bg-muted border border-border rounded-xl p-5">
              <div className="text-sm font-medium text-foreground mb-4">
                Currency
              </div>
              <Breakdown rows={exposure.currencies} />
            </div>
            {exposure.tax.length > 0 && (
              <div className="bg-muted border border-border rounded-xl p-5">
                <div className="text-sm font-medium text-foreground mb-1">
                  Tax treatment
                </div>
                <div className="text-xs text-muted-foreground mb-4">
                  Gains in a registered account are never taxed. Gains in a
                  taxable one are realised when you sell.
                </div>
                <div className="space-y-3">
                  {exposure.tax.map((t) => (
                    <div key={t.treatment} className="text-sm">
                      <div className="flex items-baseline justify-between">
                        <span className="text-foreground">{t.treatment}</span>
                        <span className="font-mono text-xs tabular-nums">
                          {formatCAD(t.value_cad, 0)}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                        <span className="truncate pr-2">
                          {t.accounts.join(", ")}
                        </span>
                        {t.unrealized_cad !== null && (
                          <span
                            className={`font-mono tabular-nums whitespace-nowrap ${t.unrealized_cad >= 0 ? "text-primary" : "text-destructive"}`}
                          >
                            {t.unrealized_cad >= 0 ? "+" : ""}
                            {formatCAD(t.unrealized_cad, 0)} unrealized
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <Card
        title="Positions"
        note={scope ? "In this account" : "Combined across all accounts"}
      >
        <table className="w-full">
          <thead>
            <tr>
              {["Security", "Units", "Market value", "Weight", "Unrealized"].map(
                (h, i) => (
                  <th
                    key={h}
                    className={`text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground px-4 py-2.5 border-b border-border ${i === 0 ? "text-left" : "text-right"}`}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {withShare.map((p) => (
              <PositionRow key={p.security} position={p} scoped={!!scope} />
            ))}
          </tbody>
        </table>
      </Card>

      {exposure && exposure.income.by_security.length > 0 && (
        <Card
          title="Projected income"
          note={`${formatCAD(exposure.income.annual_cad)} a year at current distribution rates, a ${exposure.income.yield_pct.toFixed(2)}% yield.`}
        >
          <div className="p-5">
            <Breakdown rows={exposure.income.by_security.slice(0, 8)} />
          </div>
        </Card>
      )}

      {!scope && empty.length > 0 && (
        <div className="bg-muted border border-border rounded-xl p-5">
          <div className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground mb-3">
            Awaiting first import
          </div>
          <div className="space-y-2">
            {empty.map((a) => (
              <div
                key={a.account_id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-foreground">{a.account_name}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {a.institution}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PositionRow({
  position: p,
  scoped,
}: {
  position: ConsolidatedPosition;
  scoped: boolean;
}) {
  return (
    <tr className="hover:bg-background/50 transition-colors">
      <td className="px-4 py-2.5">
        <div className="text-sm font-mono text-foreground">{p.security}</div>
        <div className="text-xs text-muted-foreground truncate max-w-sm">
          {!scoped && p.held_in.length > 1
            ? p.held_in
                .map((h) => `${h.account_name} ${h.units.toLocaleString()}`)
                .join(" · ")
            : (p.description ?? p.sector)}
        </div>
      </td>
      <td className="px-4 py-2.5 text-sm font-mono text-muted-foreground text-right tabular-nums">
        {p.units.toLocaleString(undefined, { maximumFractionDigits: 4 })}
      </td>
      <td className="px-4 py-2.5 text-sm font-mono text-foreground text-right whitespace-nowrap tabular-nums">
        {formatCAD(p.market_value_cad, 0)}
      </td>
      <td className="px-4 py-2.5 text-right">
        <div className="flex items-center justify-end gap-2">
          <div className="h-1 w-16 bg-background rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${p.percentage}%`,
                background: "var(--chart-value)",
              }}
            />
          </div>
          <span className="text-xs font-mono text-muted-foreground w-10 tabular-nums">
            {p.percentage.toFixed(1)}%
          </span>
        </div>
      </td>
      <td className="px-4 py-2.5 text-sm font-mono text-right whitespace-nowrap">
        {p.unrealized_gain_cad !== null && p.unrealized_pct !== null ? (
          <GainText amount={p.unrealized_gain_cad} pct={p.unrealized_pct} />
        ) : (
          <span className="text-muted-foreground text-xs">n/a</span>
        )}
      </td>
    </tr>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="bg-muted border border-border rounded-xl p-5">
      <div className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground mb-2">
        {label}
      </div>
      <div className="text-2xl font-light font-mono text-foreground tracking-tight">
        {value}
      </div>
      <div className="text-xs text-muted-foreground mt-1.5 truncate">{hint}</div>
    </div>
  );
}
