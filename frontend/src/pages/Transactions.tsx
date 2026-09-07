import { useEffect, useState, useCallback } from "react";
import {
  api,
  Transaction,
  Account,
  FlatCategory,
  TransactionGroup,
  Suggestion,
} from "../api/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/datepicker";
import { Pagination } from "@/components/ui/pagination";
import { GroupedReview } from "../components/GroupedReview";
import { getPeriodDates } from "../lib/periods";

const PERIODS = [
  { label: "This month", value: "this_month" },
  { label: "Last month", value: "last_month" },
  { label: "Last 3 months", value: "last_3_months" },
  { label: "Last 6 months", value: "last_6_months" },
  { label: "This year", value: "this_year" },
  { label: "All time", value: "all" },
  { label: "Custom range", value: "custom" },
];


export default function Transactions() {
  const [view, setView] = useState<"list" | "groups">("list");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [groups, setGroups] = useState<TransactionGroup[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion>>({});
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [uncategorizedTotal, setUncategorizedTotal] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<FlatCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [period, setPeriod] = useState("this_month");
  const [accountId, setAccountId] = useState("");
  const [uncategorized, setUncategorized] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Pagination
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(100);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const dates =
      period === "custom"
        ? { from: customFrom || undefined, to: customTo || undefined }
        : getPeriodDates(period);

    const filters = {
      account_id: accountId ? parseInt(accountId) : undefined,
      uncategorized: uncategorized || undefined,
      ...dates,
    };

    const [result, uncatResult, groupResult] = await Promise.all([
      api.transactions.list({
        ...filters,
        limit: pageSize,
        offset: page * pageSize,
      }),
      api.transactions.list({ ...filters, uncategorized: true, limit: 1 }),
      api.categorization.groups({
        account_id: filters.account_id,
        from: dates.from,
        to: dates.to,
      }),
    ]);

    setTransactions(result.transactions);
    setTotal(result.total);
    setUncategorizedTotal(uncatResult.total);
    setGroups(groupResult);
    setLoading(false);
  }, [period, accountId, uncategorized, customFrom, customTo, page, pageSize]);

  // Reset to page 0 when filters change
  useEffect(() => {
    setPage(0);
  }, [period, accountId, uncategorized, customFrom, customTo, pageSize]);

  useEffect(() => {
    api.accounts.list().then(setAccounts);
    api.categories.flat().then(setCategories);
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  async function handleCategoryChange(
    tx: Transaction,
    categoryId: string,
    saveRule: boolean,
  ) {
    const id = parseInt(categoryId);
    await api.transactions.updateCategory(tx.id, id, saveRule);
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id !== tx.id) return t;
        const cat = categories.find((c) => c.id === id);
        return {
          ...t,
          category_id: id,
          category_name: cat?.name ?? null,
          category_parent_name: cat?.parent_name ?? null,
          categorization_source: "manual",
        };
      }),
    );
    // Update uncategorized count
    if (!tx.category_id) {
      setUncategorizedTotal((prev) => Math.max(0, prev - 1));
    }
  }

  async function handleSuggest() {
    setSuggesting(true);
    setSuggestError(null);
    try {
      const { suggestions } = await api.categorization.suggest();
      setSuggestions(
        Object.fromEntries(suggestions.map((s) => [s.key, s])),
      );
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSuggesting(false);
    }
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="flex items-start justify-between mb-7">
        <div>
          <h2 className="text-xl font-medium text-foreground">Transactions</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {total} transactions
            {uncategorizedTotal > 0 && (
              <span className="ml-2 text-destructive">
                {uncategorizedTotal} uncategorized in {groups.length} groups
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {view === "groups" && groups.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSuggest}
              disabled={suggesting}
            >
              {suggesting ? "Asking Claude..." : "✦ Suggest categories"}
            </Button>
          )}
          <div className="flex gap-1 bg-muted border border-border rounded-lg p-1">
          {(["list", "groups"] as const).map((v) => (
            <Button
              key={v}
              variant="ghost"
              size="sm"
              onClick={() => setView(v)}
              className={`text-xs px-3 ${view === v ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
            >
              {v === "list" ? "List" : "Review groups"}
            </Button>
          ))}
          </div>
        </div>
      </div>

      {suggestError && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 mb-4">
          {suggestError}
        </div>
      )}

      {/* Filter bar */}
      <div className="bg-muted border border-border rounded-xl p-4 mb-4 flex gap-3 items-center flex-wrap">
        <Select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="w-40"
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>

        {period === "custom" && (
          <>
            <DatePicker
              value={customFrom}
              onChange={setCustomFrom}
              placeholder="From date"
            />
            <span className="text-muted-foreground text-sm">to</span>
            <DatePicker
              value={customTo}
              onChange={setCustomTo}
              placeholder="To date"
            />
          </>
        )}

        <Select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="w-48"
        >
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>

        {view === "list" && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer ml-auto">
            <input
              type="checkbox"
              checked={uncategorized}
              onChange={(e) => setUncategorized(e.target.checked)}
              className="accent-primary"
            />
            Uncategorized only
          </label>
        )}
      </div>

      {/* Transactions table */}
      <div className="bg-muted border border-border rounded-xl">
        {view === "groups" ? (
          loading ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              Loading...
            </div>
          ) : (
            <GroupedReview
              groups={groups}
              categories={categories}
              suggestions={suggestions}
              onApplied={fetchTransactions}
            />
          )
        ) : (
          <>
        {/* Top pagination */}
        {!loading && total > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}

        {loading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Loading...
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No transactions found
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                {["Date", "Account", "Description", "Amount", "Category"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground px-4 py-3 border-b border-border"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  categories={categories}
                  onCategoryChange={handleCategoryChange}
                />
              ))}
            </tbody>
          </table>
        )}

        {/* Bottom pagination */}
        {!loading && total > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
          </>
        )}
      </div>
    </div>
  );
}

function TransactionRow({
  tx,
  categories,
  onCategoryChange,
}: {
  tx: Transaction;
  categories: FlatCategory[];
  onCategoryChange: (
    tx: Transaction,
    categoryId: string,
    saveRule: boolean,
  ) => void;
}) {
  const [saveRule, setSaveRule] = useState(false);
  const [saving, setSaving] = useState(false);
  const isUncategorized = !tx.category_id;

  async function handleChange(categoryId: string) {
    setSaving(true);
    await onCategoryChange(tx, categoryId, saveRule);
    setSaving(false);
  }

  return (
    <tr
      className={`group hover:bg-background/50 transition-colors ${isUncategorized ? "bg-destructive/5" : ""}`}
    >
      <td className="px-4 py-3 text-sm font-mono text-muted-foreground whitespace-nowrap">
        {tx.date}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {tx.account_name}
      </td>
      <td
        className="px-4 py-3 text-sm max-w-xs truncate"
        title={tx.description}
      >
        {tx.description}
      </td>
      <td
        className={`px-4 py-3 text-sm font-mono whitespace-nowrap ${tx.amount >= 0 ? "text-primary" : "text-destructive"}`}
      >
        {tx.amount >= 0 ? "+" : ""}
        {Number(tx.amount).toFixed(2)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Select
            value={tx.category_id?.toString() ?? ""}
            onChange={(e) => handleChange(e.target.value)}
            disabled={saving}
            className="w-44 text-xs h-8"
          >
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parent_name ? `${c.parent_name} › ${c.name}` : c.name}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
            <input
              type="checkbox"
              checked={saveRule}
              onChange={(e) => setSaveRule(e.target.checked)}
              className="accent-primary"
            />
            Save rule
          </label>
        </div>
      </td>
    </tr>
  );
}
