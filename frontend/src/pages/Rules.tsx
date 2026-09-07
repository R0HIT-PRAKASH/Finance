import { useEffect, useState } from "react";
import { api, Rule, FlatCategory } from "../api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

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
          <p className="text-sm text-muted-foreground mt-1">
            Patterns that auto-categorize matching transactions
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleApply}
          disabled={applying || rules.length === 0}
        >
          {applying ? "Applying..." : "Apply to existing"}
        </Button>
      </div>

      {applied !== null && (
        <div className="text-sm text-primary bg-primary/10 border border-primary/20 rounded-lg px-4 py-3 mb-4">
          Categorized {applied} transaction{applied === 1 ? "" : "s"}
        </div>
      )}

      <div className="bg-muted border border-border rounded-xl p-4 mb-4 flex gap-3 items-center">
        <Input
          placeholder="Pattern, e.g. TIM HORTONS"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          className="flex-1"
        />
        <Select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-56"
        >
          <option value="">Select category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.parent_name ? `${c.parent_name} › ${c.name}` : c.name}
            </option>
          ))}
        </Select>
        <Button onClick={handleCreate} disabled={!pattern.trim() || !categoryId}>
          Add rule
        </Button>
      </div>

      <div className="bg-muted border border-border rounded-xl">
        {loading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Loading...
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No rules yet. Categorize a group on the Transactions page to create
            one automatically.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                {["Pattern", "Category", "Source", ""].map((h) => (
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
              {rules.map((rule) => (
                <tr
                  key={rule.id}
                  className="hover:bg-background/50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-mono">{rule.pattern}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {rule.category_parent_name
                      ? `${rule.category_parent_name} › ${rule.category_name}`
                      : rule.category_name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-muted-foreground border border-border rounded px-2 py-0.5">
                      {rule.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(rule.id)}
                      className="text-xs text-destructive"
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
