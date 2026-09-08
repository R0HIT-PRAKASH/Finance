import { useEffect, useState, useCallback } from "react";
import {
  api,
  Transaction,
  Account,
  FlatCategory,
  TransactionGroup,
  Suggestion,
} from "../api/client";
import { Button, Checkbox, ListBox, Select, Table } from "@heroui/react";
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

const ALL_ACCOUNTS = "all";

function categoryLabel(c: FlatCategory) {
  return c.parent_name ? `${c.parent_name} › ${c.name}` : c.name;
}

export default function Transactions() {
  const [view, setView] = useState<"list" | "groups">("list");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [groups, setGroups] = useState<TransactionGroup[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion>>(
    {},
  );
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

  // Per-row state, keyed by transaction id. React Aria's table wants a flat row
  // collection, so these cannot live in a per-row component.
  const [saveRuleIds, setSaveRuleIds] = useState<Record<number, boolean>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

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

  async function handleCategoryChange(tx: Transaction, categoryId: string) {
    const id = parseInt(categoryId);
    const saveRule = saveRuleIds[tx.id] ?? false;
    setSavingId(tx.id);
    try {
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
    } finally {
      setSavingId(null);
    }
  }

  async function handleSuggest() {
    setSuggesting(true);
    setSuggestError(null);
    try {
      const { suggestions } = await api.categorization.suggest();
      setSuggestions(Object.fromEntries(suggestions.map((s) => [s.key, s])));
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
          <p className="text-sm text-muted mt-1">
            {total} transactions
            {uncategorizedTotal > 0 && (
              <span className="ml-2 text-danger">
                {uncategorizedTotal} uncategorized in {groups.length} groups
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {view === "groups" && groups.length > 0 && (
            <Button
              isDisabled={suggesting}
              isPending={suggesting}
              size="sm"
              variant="outline"
              onPress={handleSuggest}
            >
              {suggesting ? "Asking Claude..." : "✦ Suggest categories"}
            </Button>
          )}
          <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
            {(["list", "groups"] as const).map((v) => (
              <Button
                key={v}
                size="sm"
                variant={view === v ? "primary" : "ghost"}
                onPress={() => setView(v)}
              >
                {v === "list" ? "List" : "Review groups"}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {suggestError && (
        <div className="text-sm text-danger-soft-foreground bg-danger-soft border border-danger/20 rounded-lg px-4 py-3 mb-4">
          {suggestError}
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl p-4 mb-4 flex gap-3 items-center flex-wrap">
        <Select
          aria-label="Period"
          className="w-40"
          value={period}
          onChange={(value) => value !== null && setPeriod(String(value))}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {PERIODS.map((p) => (
                <ListBox.Item key={p.value} id={p.value} textValue={p.label}>
                  {p.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        {period === "custom" && (
          <>
            <DatePicker
              value={customFrom}
              onChange={setCustomFrom}
              placeholder="From date"
            />
            <span className="text-muted text-sm">to</span>
            <DatePicker
              value={customTo}
              onChange={setCustomTo}
              placeholder="To date"
            />
          </>
        )}

        <Select
          aria-label="Account"
          className="w-48"
          value={accountId || ALL_ACCOUNTS}
          onChange={(value) =>
            setAccountId(value === ALL_ACCOUNTS ? "" : String(value))
          }
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id={ALL_ACCOUNTS} textValue="All accounts">
                All accounts
                <ListBox.ItemIndicator />
              </ListBox.Item>
              {accounts.map((a) => (
                <ListBox.Item key={a.id} id={String(a.id)} textValue={a.name}>
                  {a.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        {view === "list" && (
          <div className="ml-auto">
            <Checkbox isSelected={uncategorized} onChange={setUncategorized}>
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <span className="text-sm whitespace-nowrap">
                  Uncategorized only
                </span>
              </Checkbox.Content>
            </Checkbox>
          </div>
        )}
      </div>

      {view === "groups" ? (
        loading ? (
          <div className="bg-surface border border-border rounded-xl text-center py-16 text-muted text-sm">
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
            <div className="bg-surface border border-border rounded-xl text-center py-16 text-muted text-sm">
              Loading...
            </div>
          ) : transactions.length === 0 ? (
            <div className="bg-surface border border-border rounded-xl text-center py-16 text-muted text-sm">
              No transactions found
            </div>
          ) : (
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Transactions">
                  <Table.Header>
                    <Table.Column isRowHeader>Date</Table.Column>
                    <Table.Column>Account</Table.Column>
                    <Table.Column>Description</Table.Column>
                    <Table.Column>Amount</Table.Column>
                    <Table.Column>Category</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {transactions.map((tx) => (
                      <Table.Row key={tx.id} className="group">
                        <Table.Cell className="font-mono text-muted whitespace-nowrap">
                          {tx.date}
                        </Table.Cell>
                        <Table.Cell className="text-xs text-muted whitespace-nowrap">
                          {tx.account_name}
                        </Table.Cell>
                        <Table.Cell className="max-w-xs truncate">
                          {tx.description}
                        </Table.Cell>
                        <Table.Cell
                          className={`font-mono whitespace-nowrap ${
                            tx.amount >= 0 ? "text-success" : "text-danger"
                          }`}
                        >
                          {tx.amount >= 0 ? "+" : ""}
                          {Number(tx.amount).toFixed(2)}
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex items-center gap-2">
                            <Select
                              aria-label="Category"
                              className="w-44"
                              isDisabled={savingId === tx.id}
                              placeholder="Uncategorized"
                              value={tx.category_id?.toString() ?? null}
                              onChange={(value) =>
                                value !== null &&
                                handleCategoryChange(tx, String(value))
                              }
                            >
                              <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                              </Select.Trigger>
                              <Select.Popover>
                                <ListBox>
                                  {categories.map((c) => (
                                    <ListBox.Item
                                      key={c.id}
                                      id={String(c.id)}
                                      textValue={categoryLabel(c)}
                                    >
                                      {categoryLabel(c)}
                                      <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                  ))}
                                </ListBox>
                              </Select.Popover>
                            </Select>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <Checkbox
                                aria-label="Save rule"
                                isSelected={saveRuleIds[tx.id] ?? false}
                                onChange={(selected) =>
                                  setSaveRuleIds((prev) => ({
                                    ...prev,
                                    [tx.id]: selected,
                                  }))
                                }
                              >
                                <Checkbox.Content>
                                  <Checkbox.Control>
                                    <Checkbox.Indicator />
                                  </Checkbox.Control>
                                  <span className="text-xs whitespace-nowrap">
                                    Save rule
                                  </span>
                                </Checkbox.Content>
                              </Checkbox>
                            </div>
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          )}

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
  );
}
