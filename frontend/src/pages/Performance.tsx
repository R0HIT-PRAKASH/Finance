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
import {
  api,
  PerformanceSeries,
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
    <div className="bg-muted border border-border rounded-xl p-5 mb-4">
      <div className="text-sm font-medium text-foreground">{title}</div>
      {note && (
        <div className="mt-1 mb-4 text-xs text-muted-foreground">{note}</div>
      )}
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
          <span className="text-muted-foreground">{i.label}</span>
        </div>
      ))}
    </div>
  );
}

function ValueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <div className="font-mono text-muted-foreground mb-1.5">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-3 whitespace-nowrap">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: p.color }}
          />
          <span className="text-muted-foreground">{p.name}</span>
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
    <div className="bg-background border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <div className="font-mono text-muted-foreground mb-1.5">{row.label}</div>
      <div className="text-muted-foreground">
        {row.from} to {row.to}
      </div>
    </div>
  );
}

export default function Performance() {
  const [series, setSeries] = useState<PerformanceSeries | null>(null);
  const [returns, setReturns] = useState<ReturnsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.investments.performance(), api.investments.returns()])
      .then(([s, r]) => {
        setSeries(s);
        setReturns(r);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }
  if (!series || series.points.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
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
        <p className="text-sm text-muted-foreground mt-1">
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
                  className="fill-muted-foreground"
                  fontSize={11}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {returnRows.some((r) => r.short_window) && (
            <p className="text-xs text-muted-foreground mt-2">
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

      <div className="bg-muted border border-border rounded-xl">
        <div className="px-5 py-4 border-b border-border text-sm font-medium text-foreground">
          The same data as a table
        </div>
        <table className="w-full">
          <thead>
            <tr>
              {["Date", "Value", "Invested", "Gain"].map((h, i) => (
                <th
                  key={h}
                  className={`text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground px-4 py-2.5 border-b border-border ${i === 0 ? "text-left" : "text-right"}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {points.map((p: SeriesPoint) => (
              <tr key={p.date} className="hover:bg-background/50">
                <td className="px-4 py-2 text-sm font-mono text-muted-foreground">
                  {p.date}
                </td>
                <td className="px-4 py-2 text-sm font-mono text-right tabular-nums">
                  {formatCAD(p.value_cad)}
                </td>
                <td className="px-4 py-2 text-sm font-mono text-right tabular-nums text-muted-foreground">
                  {formatCAD(p.invested_cad)}
                </td>
                <td
                  className={`px-4 py-2 text-sm font-mono text-right tabular-nums ${p.gain_cad >= 0 ? "text-primary" : "text-destructive"}`}
                >
                  {formatCAD(p.gain_cad)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-mono text-foreground tabular-nums">
        {formatCAD(amount, 2)}
      </span>
      <span className="w-14 text-right font-mono text-xs text-muted-foreground tabular-nums">
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
    <div className="bg-muted border border-border rounded-xl p-5">
      <div className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground mb-2">
        {label}
      </div>
      <div
        className={`text-2xl font-light font-mono tracking-tight ${
          positive === undefined
            ? "text-foreground"
            : positive
              ? "text-primary"
              : "text-destructive"
        }`}
      >
        {value}
      </div>
      {hint && <div className="text-xs text-muted-foreground mt-1.5">{hint}</div>}
    </div>
  );
}
