import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Table } from "@heroui/react";
import {
  api,
  PerformanceSeries,
  PlanPeriodSummary,
  ReturnsSummary,
  SeriesPoint,
} from "../api/client";

const AXIS = "var(--chart-axis)";
const GRID = "var(--chart-grid)";
const VALUE = "var(--chart-value)";
const BENCH = "var(--chart-benchmark)";
const INCOME = "var(--chart-income)";
const INVESTED = "var(--chart-invested-stroke)";

function formatCAD(n: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits,
  }).format(n);
}

const formatPct = (n: number) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;

const formatMonth = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-CA", { month: "short" });

const axisProps = {
  stroke: AXIS,
  tick: { fill: AXIS, fontSize: 11 },
  tickLine: false,
  axisLine: false,
};

function Card({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 mb-4">
      <div className="text-sm font-medium text-foreground">{title}</div>
      {note && <div className="mt-1 mb-4 text-xs text-muted">{note}</div>}
      {!note && <div className="mb-4" />}
      {children}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-4 mb-3">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-2 text-xs">
          <span
            className="w-3 h-0.5 rounded-full"
            style={{ background: i.color }}
          />
          <span className="text-muted">{i.label}</span>
        </div>
      ))}
    </div>
  );
}

function ValueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-overlay border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <div className="font-mono text-muted mb-1.5">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-3 whitespace-nowrap">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: p.color }}
          />
          <span className="text-muted">{p.name}</span>
          <span className="ml-auto font-mono text-foreground">
            {formatCAD(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ReturnsTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="bg-overlay border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <div className="font-mono text-muted mb-1.5">{row.label}</div>
      <div className="text-muted">
        {row.from} to {row.to}
      </div>
    </div>
  );
}

export default function Performance() {
  const [series, setSeries] = useState<PerformanceSeries | null>(null);
  const [returns, setReturns] = useState<ReturnsSummary | null>(null);
  const [plans, setPlans] = useState<PlanPeriodSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.investments.performance(),
      api.investments.returns(),
      api.investments.planSummaries(),
    ])
      .then(([s, r, p]) => {
        setSeries(s);
        setReturns(r);
        setPlans(p);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-center py-16 text-muted text-sm">Loading...</div>
    );
  }
  if (!series || series.points.length === 0) {
    return (
      <div className="text-center py-16 text-muted text-sm">
        No activity imported yet, so there is nothing to chart.
      </div>
    );
  }

  const points = series.points;
  const last = points[points.length - 1];
  const contributed = last.invested_cad - series.opening_value_cad;

  const sinceStart = returns?.periods.find((p) => p.label === "Since start");
  const income = returns?.income;
  const incomeTotal = income
    ? Math.abs(income.appreciation_cad) + Math.abs(income.distributions_cad)
    : 0;

  const returnRows = (returns?.periods ?? [])
    .filter((p) => p.portfolio !== null || p.benchmark !== null)
    .map((p) => ({ ...p, you: p.portfolio ?? 0, index: p.benchmark ?? 0 }));

  return (
    <div>
      <div className="mb-7">
        <h2 className="text-xl font-medium text-foreground">Performance</h2>
        <p className="text-sm text-muted mt-1">
          Growth since {points[0].date}, when the activity record begins.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Stat label="Value" value={formatCAD(last.value_cad)} />
        <Stat
          label="Gain"
          value={formatCAD(last.gain_cad)}
          hint={`on ${formatCAD(contributed)} contributed`}
          positive={last.gain_cad >= 0}
        />
        {sinceStart?.portfolio != null && (
          <Stat
            label="Return"
            value={formatPct(sinceStart.portfolio)}
            hint="time-weighted"
            positive={sinceStart.portfolio >= 0}
          />
        )}
        {returns?.xirr != null && (
          <Stat
            label="XIRR"
            value={formatPct(returns.xirr)}
            hint="annualised, timing included"
            positive={returns.xirr >= 0}
          />
        )}
      </div>

      <Card
        title="Value and money invested"
        note="The gap between the two lines is your gain. Where value falls below invested, the portfolio is underwater."
      >
        <Legend
          items={[
            { label: "Portfolio value", color: VALUE },
            { label: "Invested", color: INVESTED },
          ]}
        />
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart
            data={points}
            margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" tickFormatter={formatMonth} {...axisProps} />
            <YAxis
              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              width={48}
              {...axisProps}
            />
            <Tooltip content={<ValueTooltip />} />
            <Line
              dataKey="invested_cad"
              name="Invested"
              stroke={INVESTED}
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="value_cad"
              name="Portfolio value"
              stroke={VALUE}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {returnRows.length > 0 && returns && (
        <Card
          title={`Return against ${returns.benchmark}`}
          note="Time-weighted, so deposit size and timing are removed and the two are comparable. The benchmark is a total return including its distributions."
        >
          <Legend
            items={[
              { label: "You", color: VALUE },
              { label: returns.benchmark, color: BENCH },
            ]}
          />
          <ResponsiveContainer width="100%" height={40 + returnRows.length * 52}>
            <BarChart
              data={returnRows}
              layout="vertical"
              margin={{ top: 0, right: 56, bottom: 0, left: 0 }}
              barGap={2}
            >
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" tickFormatter={formatPct} {...axisProps} />
              <YAxis
                type="category"
                dataKey="label"
                width={92}
                {...axisProps}
              />
              <Tooltip content={<ReturnsTooltip />} cursor={false} />
              <ReferenceLine x={0} stroke={AXIS} />
              <Bar dataKey="you" name="You" fill={VALUE} radius={[0, 4, 4, 0]}>
                <LabelList
                  dataKey="you"
                  position="right"
                  formatter={formatPct}
                  className="fill-foreground"
                  fontSize={11}
                />
              </Bar>
              <Bar
                dataKey="index"
                name={returns.benchmark}
                fill={BENCH}
                radius={[0, 4, 4, 0]}
              >
                <LabelList
                  dataKey="index"
                  position="right"
                  formatter={formatPct}
                  className="fill-muted"
                  fontSize={11}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {returnRows.some((r) => r.short_window) && (
            <p className="text-xs text-muted mt-2">
              Windows under three months are mostly noise and say little about
              how the portfolio is doing.
            </p>
          )}
        </Card>
      )}

      {income && incomeTotal > 0 && (
        <Card
          title="Where the gain came from"
          note="Price movement against income received. Distributions are cash the holdings paid out, which is why they survive a falling market."
        >
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mb-4">
            <div
              style={{
                width: `${(Math.abs(income.appreciation_cad) / incomeTotal) * 100}%`,
                background: VALUE,
              }}
            />
            <div
              style={{
                width: `${(Math.abs(income.distributions_cad) / incomeTotal) * 100}%`,
                background: INCOME,
              }}
            />
          </div>
          <div className="space-y-2">
            <IncomeRow
              color={VALUE}
              label="Price appreciation"
              amount={income.appreciation_cad}
              total={income.total_gain_cad}
            />
            <IncomeRow
              color={INCOME}
              label="Distributions and dividends"
              amount={income.distributions_cad}
              total={income.total_gain_cad}
            />
            {income.withholding_cad !== 0 && (
              <IncomeRow
                color={AXIS}
                label="Withholding tax"
                amount={income.withholding_cad}
                total={income.total_gain_cad}
              />
            )}
          </div>
        </Card>
      )}

      {plans.length > 0 && (
        <Card
          title="Group plans"
          note="These are excluded from the chart above: they publish a period summary rather than a transaction ledger, so their growth is stated rather than reconstructed."
        >
          <div className="space-y-5">
            {plans.map((p) => {
              const total =
                Math.abs(p.contributions_cad) + Math.abs(p.market_change_cad);
              return (
                <div key={`${p.account}-${p.period_end}`}>
                  <div className="flex items-baseline justify-between mb-2">
                    <div>
                      <span className="text-sm text-foreground">
                        {p.account}
                      </span>
                      <span className="ml-2 text-xs text-muted font-mono">
                        {p.period_start} to {p.period_end}
                      </span>
                    </div>
                    <span className="text-sm font-mono text-foreground tabular-nums">
                      {formatCAD(p.closing_value_cad)}
                    </span>
                  </div>
                  {total > 0 && (
                    <div className="flex h-2 rounded-full overflow-hidden gap-0.5 mb-2">
                      <div
                        style={{
                          width: `${(Math.abs(p.contributions_cad) / total) * 100}%`,
                          background: INVESTED,
                        }}
                      />
                      <div
                        style={{
                          width: `${(Math.abs(p.market_change_cad) / total) * 100}%`,
                          background: VALUE,
                        }}
                      />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
                    <span>Opened at {formatCAD(p.opening_value_cad)}</span>
                    <span>Contributed {formatCAD(p.contributions_cad)}</span>
                    <span
                      className={
                        p.market_change_cad >= 0 ? "text-success" : "text-danger"
                      }
                    >
                      Market {p.market_change_cad >= 0 ? "+" : ""}
                      {formatCAD(p.market_change_cad)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="text-sm font-medium text-foreground mb-3">
        The same data as a table
      </div>
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Performance by date">
            <Table.Header>
              <Table.Column isRowHeader>Date</Table.Column>
              <Table.Column>Value</Table.Column>
              <Table.Column>Invested</Table.Column>
              <Table.Column>Gain</Table.Column>
            </Table.Header>
            <Table.Body>
              {points.map((p: SeriesPoint) => (
                <Table.Row key={p.date}>
                  <Table.Cell className="font-mono text-muted">
                    {p.date}
                  </Table.Cell>
                  <Table.Cell className="font-mono text-right tabular-nums">
                    {formatCAD(p.value_cad)}
                  </Table.Cell>
                  <Table.Cell className="font-mono text-right tabular-nums text-muted">
                    {formatCAD(p.invested_cad)}
                  </Table.Cell>
                  <Table.Cell
                    className={`font-mono text-right tabular-nums ${
                      p.gain_cad >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {formatCAD(p.gain_cad)}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </div>
  );
}

function IncomeRow({
  color,
  label,
  amount,
  total,
}: {
  color: string;
  label: string;
  amount: number;
  total: number;
}) {
  const share = total !== 0 ? (amount / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ background: color }}
      />
      <span className="text-muted">{label}</span>
      <span className="ml-auto font-mono text-foreground tabular-nums">
        {formatCAD(amount, 2)}
      </span>
      <span className="w-14 text-right font-mono text-xs text-muted tabular-nums">
        {share.toFixed(1)}%
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  positive,
}: {
  label: string;
  value: string;
  hint?: string;
  positive?: boolean;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="text-sm text-muted mb-2">{label}</div>
      <div
        className={`text-2xl font-light font-mono tracking-tight ${
          positive === undefined
            ? "text-foreground"
            : positive
              ? "text-success"
              : "text-danger"
        }`}
      >
        {value}
      </div>
      {hint && <div className="text-xs text-muted mt-1.5">{hint}</div>}
    </div>
  );
}
