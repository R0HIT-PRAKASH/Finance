import { useEffect, useState } from "react";
import {
  api,
  AccountPortfolio,
  Allocation,
  ConsolidatedPosition,
  PortfolioResponse,
  Position,
} from "../api/client";
import { Button } from "@/components/ui/button";

function formatCAD(amount: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
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

export default function Portfolio() {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);

  function load() {
    return api.investments.portfolio().then(setData);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshNote(null);
    try {
      const r = await api.investments.refreshPrices();
      const parts = [`Priced ${r.quoted} of ${r.requested}`];
      if (r.failed.length) parts.push(`${r.failed.length} failed`);
      if (r.unquotable.length) parts.push(`${r.unquotable.length} have no quote`);
      if (r.fx_updated) parts.push(`FX ${r.fx_date}`);
      setRefreshNote(parts.join(" · "));
      await load();
    } catch (err) {
      setRefreshNote(err instanceof Error ? err.message : "Refresh failed");
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

  // Snapshots are imported per account, so a single "as of" would be misleading.
  const spansDates = totals.as_of_earliest !== totals.as_of_latest;

  return (
    <div>
      <div className="flex items-start justify-between mb-7">
        <div>
          <h2 className="text-xl font-medium text-foreground">Portfolio</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {funded.length === 0
              ? "No holdings imported yet"
              : spansDates
                ? `Statements ${totals.as_of_earliest} to ${totals.as_of_latest} (varies by account)`
                : `Statements as of ${totals.as_of_latest}`}
          </p>
        </div>
        {funded.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh prices"}
          </Button>
        )}
      </div>

      {refreshNote && (
        <div className="text-sm text-muted-foreground bg-muted border border-border rounded-lg px-4 py-3 mb-4">
          {refreshNote}
        </div>
      )}

      {funded.length > 0 && (
        <div className="bg-muted border border-border rounded-xl p-6 mb-4">
          <div className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground mb-2">
            Total Value
            {totals.oldest_price_date && (
              <span className="ml-2 normal-case tracking-normal text-muted-foreground/60">
                priced {totals.oldest_price_date}
              </span>
            )}
          </div>
          <div className="text-4xl font-light font-mono text-foreground tracking-tight">
            {formatCAD(totals.live_total_value_cad)}
          </div>
          <div className="text-sm text-muted-foreground mt-3 flex flex-wrap gap-x-6 gap-y-1">
            <span>Book {formatCAD(totals.book_value_cad)}</span>
            <span>
              Unrealized{" "}
              <GainText
                amount={totals.live_unrealized_cad}
                pct={totals.live_unrealized_pct}
              />
            </span>
            {Math.abs(totals.live_total_value_cad - totals.total_value_cad) >
              0.5 && (
              <span>
                Statement {formatCAD(totals.total_value_cad)}
              </span>
            )}
            {totals.cash_cad !== 0 && (
              <span>Cash {formatCAD(totals.cash_cad)}</span>
            )}
          </div>
          {totals.accounts_without_basis > 0 && (
            <p className="text-xs text-muted-foreground/70 mt-2">
              Gain excludes {formatCAD(totals.market_value_without_basis)} across{" "}
              {totals.accounts_without_basis} account
              {totals.accounts_without_basis === 1 ? "" : "s"} that report no
              cost basis.
            </p>
          )}
        </div>
      )}

      {data.positions.length > 0 && (
        <PositionsCard positions={data.positions} />
      )}

      {funded.map((account) => (
        <AccountCard key={account.account_id} account={account} />
      ))}

      {funded.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mt-4">

          <AllocationCard title="By Sector" rows={data.allocation.sector} />
          <AllocationCard
            title="By Asset Class"
            rows={data.allocation.asset_class}
          />
        </div>
      )}

      {empty.length > 0 && (
        <div className="bg-muted border border-border rounded-xl p-5 mt-4">
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

function PositionsCard({ positions }: { positions: ConsolidatedPosition[] }) {
  return (
    <div className="bg-muted border border-border rounded-xl mb-4">
      <div className="px-5 py-4 border-b border-border">
        <div className="text-sm font-medium text-foreground">Positions</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          Combined across all accounts
        </div>
      </div>
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
          {positions.map((p) => (
            <tr key={p.security} className="hover:bg-background/50 transition-colors">
              <td className="px-4 py-2.5">
                <div className="text-sm font-mono text-foreground">
                  {p.security}
                </div>
                <div className="text-xs text-muted-foreground">
                  {p.held_in.length > 1
                    ? p.held_in
                        .map((h) => `${h.account_name} ${h.units.toLocaleString()}`)
                        .join(" · ")
                    : p.description}
                </div>
              </td>
              <td className="px-4 py-2.5 text-sm font-mono text-muted-foreground text-right">
                {p.units.toLocaleString(undefined, {
                  maximumFractionDigits: 4,
                })}
              </td>
              <td className="px-4 py-2.5 text-sm font-mono text-foreground text-right whitespace-nowrap">
                {formatCAD(p.market_value_cad)}
              </td>
              <td className="px-4 py-2.5 text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="h-1 w-16 bg-background rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/50 rounded-full"
                      style={{ width: `${p.percentage}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground w-10">
                    {p.percentage.toFixed(1)}%
                  </span>
                </div>
              </td>
              <td className="px-4 py-2.5 text-sm font-mono text-right whitespace-nowrap">
                {p.unrealized_gain_cad !== null && p.unrealized_pct !== null ? (
                  <GainText
                    amount={p.unrealized_gain_cad}
                    pct={p.unrealized_pct}
                  />
                ) : (
                  <span className="text-muted-foreground text-xs">n/a</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Most accounts are named after their registration, so the badge would repeat it. */
function registrationBadge(account: AccountPortfolio): string | null {
  const kind = account.registered_type;
  if (!kind || kind === "none") return null;
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  return normalize(kind) === normalize(account.account_name) ? null : kind;
}

function AccountCard({ account }: { account: AccountPortfolio }) {
  const badge = registrationBadge(account);

  return (
    <div className="bg-muted border border-border rounded-xl mb-4">
      <div className="flex items-start justify-between px-5 py-4 border-b border-border">
        <div>
          <div className="text-sm font-medium text-foreground">
            {account.account_name}
            {badge && (
              <span className="ml-2 text-xs font-mono text-primary/70">
                {badge}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground font-mono mt-0.5">
            {account.institution} · as of {account.as_of}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-mono text-foreground">
            {formatCAD(account.live_total_value_cad)}
          </div>
          <div className="text-xs font-mono">
            {account.live_unrealized_cad !== null &&
            account.live_unrealized_pct !== null ? (
              <GainText
                amount={account.live_unrealized_cad}
                pct={account.live_unrealized_pct}
              />
            ) : (
              <span className="text-muted-foreground">no cost basis</span>
            )}
          </div>
        </div>
      </div>

      <table className="w-full">
        <thead>
          <tr>
            {["Security", "Units", "Avg cost", "Price", "Market value", "Unrealized"].map(
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
          {account.positions.map((p) => (
            <PositionRow key={p.security} position={p} />
          ))}
          {account.cash.map((c) => (
            <tr key={c.currency} className="text-muted-foreground">
              <td className="px-4 py-2.5 text-sm font-mono">
                Cash
                <span className="ml-1.5 text-xs">{c.currency}</span>
              </td>
              <td colSpan={3} />
              <td className="px-4 py-2.5 text-sm font-mono text-right whitespace-nowrap">
                {formatCAD(c.amount_cad)}
                {c.currency !== "CAD" && (
                  <span className="ml-1 text-xs text-muted-foreground/60">
                    ({c.amount.toFixed(2)} {c.currency}
                    {c.rate_missing && ", no rate"})
                  </span>
                )}
              </td>
              <td />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PositionRow({ position: p }: { position: Position }) {
  const foreign = p.settlement_currency !== "CAD";
  return (
    <tr className="hover:bg-background/50 transition-colors">
      <td className="px-4 py-2.5">
        <div className="text-sm font-mono text-foreground">{p.security}</div>
        <div className="text-xs text-muted-foreground truncate max-w-xs">
          {p.description}
          {p.sector && ` · ${p.sector}`}
        </div>
      </td>
      <td className="px-4 py-2.5 text-sm font-mono text-muted-foreground text-right">
        {p.units.toLocaleString()}
      </td>
      <td className="px-4 py-2.5 text-sm font-mono text-muted-foreground text-right whitespace-nowrap">
        {p.average_cost?.toFixed(2)}
        {foreign && (
          <span className="ml-1 text-xs text-muted-foreground/60">
            {p.settlement_currency}
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-sm font-mono text-muted-foreground text-right whitespace-nowrap">
        {p.live_price?.toFixed(2)}
        {foreign && (
          <span className="ml-1 text-xs text-muted-foreground/60">
            {p.settlement_currency}
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-sm font-mono text-foreground text-right whitespace-nowrap">
        {formatCAD(p.live_value_cad ?? p.market_value_cad)}
      </td>
      <td className="px-4 py-2.5 text-sm font-mono text-right whitespace-nowrap">
        {p.unrealized_gain_cad !== null && p.book_value_cad !== null && (
          <GainText
            amount={p.unrealized_gain_cad}
            pct={
              p.book_value_cad === 0
                ? 0
                : (p.unrealized_gain_cad / p.book_value_cad) * 100
            }
          />
        )}
      </td>
    </tr>
  );
}

function AllocationCard({ title, rows }: { title: string; rows: Allocation[] }) {
  return (
    <div className="bg-muted border border-border rounded-xl p-5">
      <div className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground mb-4">
        {title}
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex items-baseline justify-between text-sm mb-1">
              <span className="text-foreground">{r.label}</span>
              <span className="font-mono text-muted-foreground text-xs">
                {r.percentage.toFixed(1)}% · {formatCAD(r.market_value_cad)}
              </span>
            </div>
            <div className="h-1 bg-background rounded-full overflow-hidden">
              <div
                className="h-full bg-primary/50 rounded-full"
                style={{ width: `${r.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
