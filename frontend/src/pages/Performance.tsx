import { useEffect, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, PerformanceSeries, SeriesPoint } from "../api/client";

const AXIS = "var(--chart-axis)";
const GRID = "var(--chart-grid)";
const VALUE = "var(--chart-value)";
const BENCH = "var(--chart-benchmark)";
const INVESTED_FILL = "var(--chart-invested-fill)";
const INVESTED_STROKE = "var(--chart-invested-stroke)";

function formatCAD(n: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatMonth(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-CA", {
    month: "short",
  });
}

/** Values are all CAD on one scale, so a single shared axis is correct. */
const axisProps = {
  stroke: AXIS,
  tick: { fill: AXIS, fontSize: 11 },
  tickLine: false,
  axisLine: false,
};

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <div className="font-mono text-muted-foreground mb-1.5">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 whitespace-nowrap">
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

/** Identity is never carried by colour alone: every series is named here too. */
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

function Variant({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-muted border border-border rounded-xl p-5 mb-4">
      <div className="mb-1 text-sm font-medium text-foreground">{title}</div>
      <div className="mb-4 text-xs text-muted-foreground">{note}</div>
      {children}
    </div>
  );
}

export default function Performance() {
  const [data, setData] = useState<PerformanceSeries | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.investments
      .performance()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }
  if (!data || data.points.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        No activity imported yet, so there is nothing to chart.
      </div>
    );
  }

  const points = data.points;
  const last = points[points.length - 1];
  const contributed = last.invested_cad - data.opening_value_cad;
  const vsBench = last.benchmark_cad ? last.value_cad - last.benchmark_cad : null;

  const common = (
    <>
      <CartesianGrid stroke={GRID} vertical={false} />
      <XAxis dataKey="date" tickFormatter={formatMonth} {...axisProps} />
      <YAxis
        tickFormatter={(v) => `${Math.round(v / 1000)}k`}
        width={48}
        {...axisProps}
      />
      <Tooltip content={<ChartTooltip />} />
    </>
  );

  return (
    <div>
      <div className="mb-7">
        <h2 className="text-xl font-medium text-foreground">Performance</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Three chart options for the same data. Pick one and I will drop the
          other two.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat label="Value" value={formatCAD(last.value_cad)} />
        <Stat
          label="Gain"
          value={formatCAD(last.gain_cad)}
          hint={`on ${formatCAD(contributed)} contributed`}
          positive={last.gain_cad >= 0}
        />
        {vsBench !== null && (
          <Stat
            label={`vs ${data.benchmark}`}
            value={formatCAD(vsBench)}
            hint={vsBench >= 0 ? "ahead of the index" : "behind the index"}
            positive={vsBench >= 0}
          />
        )}
      </div>

      <Variant
        title="Option A: invested as a filled band, value and benchmark as lines"
        note="The gap between the blue line and the top of the band is your gain. When value dips below the band the position is underwater, which is what happened in April."
      >
        <Legend
          items={[
            { label: "Portfolio value", color: VALUE },
            { label: `${data.benchmark} benchmark`, color: BENCH },
            { label: "Invested", color: INVESTED_STROKE },
          ]}
        />
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            {common}
            <Area
              dataKey="invested_cad"
              name="Invested"
              stroke={INVESTED_STROKE}
              fill={INVESTED_FILL}
              strokeWidth={1}
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
            <Line
              dataKey="benchmark_cad"
              name={`${data.benchmark}`}
              stroke={BENCH}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Variant>

      <Variant
        title="Option B: three plain lines"
        note="Everything is a peer series. Simplest to read, but how much you put in versus earned is less immediate without a fill."
      >
        <Legend
          items={[
            { label: "Portfolio value", color: VALUE },
            { label: `${data.benchmark} benchmark`, color: BENCH },
            { label: "Invested", color: INVESTED_STROKE },
          ]}
        />
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            {common}
            <Line
              dataKey="invested_cad"
              name="Invested"
              stroke={INVESTED_STROKE}
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
            <Line
              dataKey="benchmark_cad"
              name={`${data.benchmark}`}
              stroke={BENCH}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Variant>

      <Variant
        title="Option C: value against benchmark, with gain split out below"
        note="Gain gets its own axis where negative is natural rather than awkward. Costs you the single glance."
      >
        <Legend
          items={[
            { label: "Portfolio value", color: VALUE },
            { label: `${data.benchmark} benchmark`, color: BENCH },
          ]}
        />
        <ResponsiveContainer width="100%" height={190}>
          <ComposedChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            {common}
            <Line
              dataKey="value_cad"
              name="Portfolio value"
              stroke={VALUE}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="benchmark_cad"
              name={`${data.benchmark}`}
              stroke={BENCH}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="mt-3 mb-2 text-xs text-muted-foreground">
          Gain over the window
        </div>
        <ResponsiveContainer width="100%" height={120}>
          <ComposedChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" tickFormatter={formatMonth} {...axisProps} />
            <YAxis
              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              width={48}
              {...axisProps}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              dataKey="gain_cad"
              name="Gain"
              stroke={VALUE}
              fill={VALUE}
              fillOpacity={0.18}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Variant>

      <div className="bg-muted border border-border rounded-xl">
        <div className="px-5 py-4 border-b border-border text-sm font-medium text-foreground">
          The same data as a table
        </div>
        <table className="w-full">
          <thead>
            <tr>
              {["Date", "Value", "Invested", "Gain", data.benchmark ?? "Benchmark"].map(
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
                <td className="px-4 py-2 text-sm font-mono text-right tabular-nums text-muted-foreground">
                  {p.benchmark_cad !== null ? formatCAD(p.benchmark_cad) : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
      {hint && (
        <div className="text-xs text-muted-foreground mt-1.5">{hint}</div>
      )}
    </div>
  );
}
