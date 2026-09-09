import { useEffect, useState } from "react";
import { api, Rule, FlatCategory } from "../api/client";
import { Button, Input, Table, TextField } from "@heroui/react";
import { CategoryPicker } from "../components/CategoryPicker";

function categoryLabel(
  parent: string | null | undefined,
  name: string | null | undefined,
) {
  if (!name) return parent ?? "";
  return parent ? `${parent} › ${name}` : name;
}

export default function Rules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<FlatCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [pattern, setPattern] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<number | null>(null);

  async function load() {
    const [r, c] = await Promise.all([
      api.categorization.rules(),
      api.categories.flat(),
    ]);
    setRules(r);
    setCategories(c);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    if (!pattern.trim() || !categoryId) return;
    await api.categorization.createRule(pattern.trim(), parseInt(categoryId));
    setPattern("");
    setCategoryId("");
    load();
  }

  async function handleDelete(id: number) {
    await api.categorization.deleteRule(id);
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleApply() {
    setApplying(true);
    setApplied(null);
    try {
      const result = await api.categorization.applyRules();
      setApplied(result.updated);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-7">
        <div>
          <h2 className="text-xl font-medium text-foreground">Rules</h2>
          <p className="text-sm text-muted mt-1">
            Patterns that auto-categorize matching transactions
          </p>
        </div>
        <Button
          variant="outline"
          isDisabled={applying || rules.length === 0}
          onPress={handleApply}
        >
          {applying ? "Applying..." : "Apply to existing"}
        </Button>
      </div>

      {applied !== null && (
        <div className="text-sm text-accent bg-accent/10 border border-accent/20 rounded-lg px-4 py-3 mb-4">
          Categorized {applied} transaction{applied === 1 ? "" : "s"}
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl p-4 mb-4 flex gap-3 items-center">
        <TextField
          aria-label="Pattern"
          className="flex-1"
          value={pattern}
          onChange={setPattern}
        >
          <Input placeholder="Pattern, e.g. TIM HORTONS" />
        </TextField>
        <CategoryPicker
          categories={categories}
          value={categoryId ? parseInt(categoryId) : null}
          onSelect={(id) => setCategoryId(String(id))}
        />
        <Button
          isDisabled={!pattern.trim() || !categoryId}
          onPress={handleCreate}
        >
          Add rule
        </Button>
      </div>

      {loading ? (
        <div className="bg-surface border border-border rounded-xl text-center py-16 text-muted text-sm">
          Loading...
        </div>
      ) : rules.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl text-center py-16 text-muted text-sm">
          No rules yet. Categorize a group on the Transactions page to create one
          automatically.
        </div>
      ) : (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Categorization rules">
              <Table.Header>
                <Table.Column isRowHeader>Pattern</Table.Column>
                <Table.Column>Category</Table.Column>
                <Table.Column>Source</Table.Column>
                <Table.Column>{""}</Table.Column>
              </Table.Header>
              <Table.Body>
                {rules.map((rule) => (
                  <Table.Row key={rule.id}>
                    <Table.Cell className="font-mono">{rule.pattern}</Table.Cell>
                    <Table.Cell className="text-muted">
                      {categoryLabel(
                        rule.category_parent_name,
                        rule.category_name,
                      )}
                    </Table.Cell>
                    <Table.Cell className="text-muted">
                      {rule.source}
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <Button
                        size="sm"
                        variant="danger-soft"
                        onPress={() => handleDelete(rule.id)}
                      >
                        Remove
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}
    </div>
  );
}
