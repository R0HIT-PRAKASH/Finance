import { useState } from "react";
import {
  api,
  TransactionGroup,
  GroupedTransaction,
  FlatCategory,
  Suggestion,
} from "../api/client";
import { Select } from "@/components/ui/select";

type Props = {
  groups: TransactionGroup[];
  categories: FlatCategory[];
  suggestions: Record<string, Suggestion>;
  onApplied: () => void;
};

function CategorySelect({
  categories,
  disabled,
  placeholder,
  onSelect,
}: {
  categories: FlatCategory[];
  disabled: boolean;
  placeholder: string;
  onSelect: (categoryId: number) => void;
}) {
  return (
    <Select
      value=""
      onChange={(e) => e.target.value && onSelect(parseInt(e.target.value))}
      disabled={disabled}
      className="w-44 text-xs h-8"
    >
      <option value="">{placeholder}</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.parent_name ? `${c.parent_name} › ${c.name}` : c.name}
        </option>
      ))}
    </Select>
  );
}

export function GroupedReview({
  groups,
  categories,
  suggestions,
  onApplied,
}: Props) {
  if (groups.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        Nothing uncategorized — you're all caught up.
      </div>
    );
  }

  return (
    <table className="w-full">
      <thead>
        <tr>
          {["Merchant", "Count", "Total", "Category"].map((h) => (
            <th
              key={h}
              className="text-left text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground px-4 py-3 border-b border-border"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {groups.map((group) => (
          <GroupRow
            key={group.pattern}
            group={group}
            categories={categories}
            suggestion={suggestions[group.pattern]}
            onApplied={onApplied}
          />
        ))}
      </tbody>
    </table>
  );
}

function GroupRow({
  group,
  categories,
  suggestion,
  onApplied,
}: {
  group: TransactionGroup;
  categories: FlatCategory[];
  suggestion?: Suggestion;
  onApplied: () => void;
}) {
  // Groups needing individual judgment open expanded — the rows are the point.
  const [expanded, setExpanded] = useState(!group.bulk_assignable);
  const [saveRule, setSaveRule] = useState(group.rulable);
  const [saving, setSaving] = useState(false);

  const suggestedCategory = suggestion?.category_id
    ? categories.find((c) => c.id === suggestion.category_id)
    : undefined;

  async function applyToAll(categoryId: number) {
    setSaving(true);
    try {
      await api.categorization.applyGroup(
        group.transactions.map((t) => t.id),
        categoryId,
        saveRule && group.rulable ? group.pattern : undefined,
      );
      onApplied();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <tr className="group hover:bg-background/50 transition-colors align-top">
        <td className="px-4 py-3">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-sm font-mono text-left hover:text-primary transition-colors"
          >
            <span className="text-muted-foreground mr-1.5">
              {expanded ? "▾" : "▸"}
            </span>
            {group.pattern}
          </button>
          {!group.bulk_assignable && (
            <div className="text-xs text-muted-foreground mt-1 ml-4">
              transfers between people — purpose varies, so categorize each one
            </div>
          )}
          {group.bulk_assignable && !group.rulable && (
            <div className="text-xs text-muted-foreground mt-1 ml-4">
              no reusable pattern — won't create a rule
            </div>
          )}
        </td>
        <td className="px-4 py-3 text-sm font-mono text-muted-foreground whitespace-nowrap">
          {group.count}
        </td>
        <td
          className={`px-4 py-3 text-sm font-mono whitespace-nowrap ${group.total_amount >= 0 ? "text-primary" : "text-destructive"}`}
        >
          {group.total_amount >= 0 ? "+" : ""}
          {group.total_amount.toFixed(2)}
        </td>
        <td className="px-4 py-3">
          {group.bulk_assignable && (
            <div className="flex items-center gap-2">
              <CategorySelect
                categories={categories}
                disabled={saving}
                placeholder={saving ? "Applying..." : "Select category"}
                onSelect={applyToAll}
              />
              {suggestedCategory && (
                <button
                  onClick={() => applyToAll(suggestedCategory.id)}
                  disabled={saving}
                  title="Suggested by Claude — click to accept"
                  className={`text-xs font-mono rounded px-2 py-1 border transition-colors whitespace-nowrap ${
                    suggestion?.confidence === "high"
                      ? "border-primary/30 text-primary hover:bg-primary/10"
                      : "border-border text-muted-foreground hover:bg-background/50"
                  }`}
                >
                  ✦ {suggestedCategory.name}
                  {suggestion?.confidence === "low" && " ?"}
                </button>
              )}
              {group.rulable && (
                <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={saveRule}
                    onChange={(e) => setSaveRule(e.target.checked)}
                    className="accent-primary"
                  />
                  Save rule
                </label>
              )}
            </div>
          )}
        </td>
      </tr>
      {expanded &&
        group.transactions.map((tx) => (
          <TransactionDetailRow
            key={tx.id}
            tx={tx}
            categories={categories}
            assignable={!group.bulk_assignable}
            onApplied={onApplied}
          />
        ))}
    </>
  );
}

function TransactionDetailRow({
  tx,
  categories,
  assignable,
  onApplied,
}: {
  tx: GroupedTransaction;
  categories: FlatCategory[];
  assignable: boolean;
  onApplied: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function handleSelect(categoryId: number) {
    setSaving(true);
    try {
      await api.categorization.applyGroup([tx.id], categoryId);
      onApplied();
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="bg-background/30">
      <td className="px-4 py-2 pl-11">
        <div className="text-xs font-mono text-muted-foreground">
          {tx.description}
        </div>
      </td>
      <td className="px-4 py-2 text-xs font-mono text-muted-foreground whitespace-nowrap">
        {tx.date}
      </td>
      <td
        className={`px-4 py-2 text-xs font-mono whitespace-nowrap ${tx.amount >= 0 ? "text-primary" : "text-destructive"}`}
      >
        {tx.amount >= 0 ? "+" : ""}
        {tx.amount.toFixed(2)}
      </td>
      <td className="px-4 py-2">
        {assignable && (
          <CategorySelect
            categories={categories}
            disabled={saving}
            placeholder={saving ? "Saving..." : "Select category"}
            onSelect={handleSelect}
          />
        )}
      </td>
    </tr>
  );
}
