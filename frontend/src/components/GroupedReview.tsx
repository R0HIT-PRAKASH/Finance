import { useState } from "react";
import {
  api,
  TransactionGroup,
  GroupedTransaction,
  FlatCategory,
  Suggestion,
} from "../api/client";
import { Button, Checkbox, ListBox, Select, Table } from "@heroui/react";

type Props = {
  groups: TransactionGroup[];
  categories: FlatCategory[];
  suggestions: Record<string, Suggestion>;
  onApplied: () => void;
};

function categoryLabel(c: FlatCategory) {
  return c.parent_name ? `${c.parent_name} › ${c.name}` : c.name;
}

function CategorySelect({
  categories,
  isDisabled,
  placeholder,
  onSelect,
}: {
  categories: FlatCategory[];
  isDisabled: boolean;
  placeholder: string;
  onSelect: (categoryId: number) => void;
}) {
  return (
    <Select
      aria-label="Category"
      className="w-44"
      isDisabled={isDisabled}
      placeholder={placeholder}
      value={null}
      onChange={(value) => value !== null && onSelect(Number(value))}
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
  );
}

export function GroupedReview({
  groups,
  categories,
  suggestions,
  onApplied,
}: Props) {
  // Keyed by pattern rather than held per row, because React Aria's table wants
  // a flat row collection and cannot nest a component around each group.
  // Absent keys fall back to the group's own defaults, so a changed `groups`
  // prop still gets the right initial state without an effect.
  const [expandedOverrides, setExpandedOverrides] = useState<
    Record<string, boolean>
  >({});
  const [saveRuleOverrides, setSaveRuleOverrides] = useState<
    Record<string, boolean>
  >({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Groups needing individual judgment open expanded, the rows are the point.
  const isExpanded = (group: TransactionGroup) =>
    expandedOverrides[group.pattern] ?? !group.bulk_assignable;
  const isSaveRule = (group: TransactionGroup) =>
    saveRuleOverrides[group.pattern] ?? group.rulable;

  async function applyToAll(group: TransactionGroup, categoryId: number) {
    setSavingKey(group.pattern);
    try {
      await api.categorization.applyGroup(
        group.transactions.map((t) => t.id),
        categoryId,
        isSaveRule(group) && group.rulable ? group.pattern : undefined,
      );
      onApplied();
    } finally {
      setSavingKey(null);
    }
  }

  async function applyOne(tx: GroupedTransaction, categoryId: number) {
    setSavingKey(`tx-${tx.id}`);
    try {
      await api.categorization.applyGroup([tx.id], categoryId);
      onApplied();
    } finally {
      setSavingKey(null);
    }
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-16 text-muted text-sm">
        Nothing uncategorized. You're all caught up.
      </div>
    );
  }

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label="Uncategorized transaction groups">
          <Table.Header>
            <Table.Column isRowHeader>Merchant</Table.Column>
            <Table.Column>Count</Table.Column>
            <Table.Column>Total</Table.Column>
            <Table.Column>Category</Table.Column>
          </Table.Header>
          <Table.Body>
            {groups.flatMap((group) => {
              const suggestion = suggestions[group.pattern];
              const suggestedCategory = suggestion?.category_id
                ? categories.find((c) => c.id === suggestion.category_id)
                : undefined;
              const groupSaving = savingKey === group.pattern;

              const rows = [
                <Table.Row key={group.pattern}>
                  <Table.Cell>
                    <button
                      className="text-sm font-mono text-left hover:text-accent transition-colors"
                      onClick={() =>
                        setExpandedOverrides((prev) => ({
                          ...prev,
                          [group.pattern]: !isExpanded(group),
                        }))
                      }
                    >
                      <span className="text-muted mr-1.5">
                        {isExpanded(group) ? "▾" : "▸"}
                      </span>
                      {group.pattern}
                    </button>
                    {!group.bulk_assignable && (
                      <div className="text-xs text-muted mt-1 ml-4">
                        transfers between people: purpose varies, so categorize
                        each one
                      </div>
                    )}
                    {group.bulk_assignable && !group.rulable && (
                      <div className="text-xs text-muted mt-1 ml-4">
                        no reusable pattern, won't create a rule
                      </div>
                    )}
                  </Table.Cell>
                  <Table.Cell className="font-mono text-muted whitespace-nowrap">
                    {group.count}
                  </Table.Cell>
                  <Table.Cell
                    className={`font-mono whitespace-nowrap ${
                      group.total_amount >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {group.total_amount >= 0 ? "+" : ""}
                    {group.total_amount.toFixed(2)}
                  </Table.Cell>
                  <Table.Cell>
                    {group.bulk_assignable && (
                      <div className="flex items-center gap-2">
                        <CategorySelect
                          categories={categories}
                          isDisabled={groupSaving}
                          placeholder={
                            groupSaving ? "Applying..." : "Select category"
                          }
                          onSelect={(categoryId) =>
                            applyToAll(group, categoryId)
                          }
                        />
                        {suggestedCategory && (
                          <Button
                            isDisabled={groupSaving}
                            size="sm"
                            variant={
                              suggestion?.confidence === "high"
                                ? "secondary"
                                : "tertiary"
                            }
                            onPress={() =>
                              applyToAll(group, suggestedCategory.id)
                            }
                          >
                            ✦ {suggestedCategory.name}
                            {suggestion?.confidence === "low" && " ?"}
                          </Button>
                        )}
                        {group.rulable && (
                          <Checkbox
                            aria-label="Save rule"
                            isSelected={isSaveRule(group)}
                            onChange={(selected) =>
                              setSaveRuleOverrides((prev) => ({
                                ...prev,
                                [group.pattern]: selected,
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
                        )}
                      </div>
                    )}
                  </Table.Cell>
                </Table.Row>,
              ];

              if (isExpanded(group)) {
                for (const tx of group.transactions) {
                  rows.push(
                    <Table.Row key={`${group.pattern}-${tx.id}`}>
                      <Table.Cell className="pl-11 text-xs font-mono text-muted">
                        {tx.description}
                      </Table.Cell>
                      <Table.Cell className="text-xs font-mono text-muted whitespace-nowrap">
                        {tx.date}
                      </Table.Cell>
                      <Table.Cell
                        className={`text-xs font-mono whitespace-nowrap ${
                          tx.amount >= 0 ? "text-success" : "text-danger"
                        }`}
                      >
                        {tx.amount >= 0 ? "+" : ""}
                        {tx.amount.toFixed(2)}
                      </Table.Cell>
                      <Table.Cell>
                        {!group.bulk_assignable && (
                          <CategorySelect
                            categories={categories}
                            isDisabled={savingKey === `tx-${tx.id}`}
                            placeholder={
                              savingKey === `tx-${tx.id}`
                                ? "Saving..."
                                : "Select category"
                            }
                            onSelect={(categoryId) => applyOne(tx, categoryId)}
                          />
                        )}
                      </Table.Cell>
                    </Table.Row>,
                  );
                }
              }

              return rows;
            })}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
