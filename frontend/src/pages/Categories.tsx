import { useEffect, useMemo, useState } from "react";
import {
  api,
  CategoryKind,
  CreateCategoryInput,
  FlatCategory,
} from "../api/client";
import { Button, Input, ListBox, Select, TextField } from "@heroui/react";

/** Mirrors MAX_DEPTH in the categories repository, which is the real gate. */
const MAX_DEPTH = 3;

const KINDS: {
  value: CategoryKind;
  label: string;
  heading: string;
  hint: string;
}[] = [
  {
    value: "expense",
    label: "Expense",
    heading: "Spending",
    hint: "money leaving your accounts, counted as spending",
  },
  {
    value: "income",
    label: "Income",
    heading: "Income",
    hint: "money arriving, counted as income",
  },
  {
    value: "transfer",
    label: "Transfer",
    heading: "Transfers",
    hint: "movement between your own accounts, excluded from both totals",
  },
];

export default function Categories() {
  const [categories, setCategories] = useState<FlatCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // One row at a time is editable, so a single id per mode is enough state.
  const [sectorForm, setSectorForm] = useState<{
    name: string;
    kind: CategoryKind;
  } | null>(null);
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const [childName, setChildName] = useState("");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameName, setRenameName] = useState("");
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  async function load() {
    setCategories(await api.categories.flat());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function closeForms() {
    setSectorForm(null);
    setAddingTo(null);
    setChildName("");
    setRenamingId(null);
    setRenameName("");
    setConfirmingId(null);
  }

  /** Every mutation reloads, because depth and is_leaf shift under an edit. */
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      closeForms();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const create = (data: CreateCategoryInput) =>
    run(() => api.categories.create(data));

  // Sectors group by kind rather than wearing it as a badge. Repeating
  // "Expense" on every card to make the one "Transfer" legible is noise; a
  // heading says the same thing once and puts Investments where it belongs,
  // outside spending. Within a sector, path order keeps parents above children.
  const kindGroups = useMemo(() => {
    const byRoot = new Map<number, FlatCategory[]>();
    for (const c of [...categories].sort((a, b) =>
      a.path.localeCompare(b.path),
    )) {
      const list = byRoot.get(c.root_id) ?? [];
      list.push(c);
      byRoot.set(c.root_id, list);
    }
    const sectors = [...byRoot.values()];
    return KINDS.map((kind) => ({
      kind,
      sectors: sectors.filter((rows) => rows[0].kind === kind.value),
    })).filter((group) => group.sectors.length > 0);
  }, [categories]);

  const childCount = (id: number) =>
    categories.filter((c) => c.parent_id === id).length;

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-xl text-center py-16 text-muted text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-7">
        <div>
          <h2 className="text-xl font-medium text-foreground">Categories</h2>
          <p className="text-sm text-muted mt-1">
            Sectors and the sub-categories inside them. Insights roll up either
            level, so filing on a sector is a real answer, not a half-finished
            one.
          </p>
        </div>
        <Button
          variant="outline"
          isDisabled={busy}
          onPress={() =>
            sectorForm
              ? closeForms()
              : setSectorForm({ name: "", kind: "expense" })
          }
        >
          {sectorForm ? "Cancel" : "New sector"}
        </Button>
      </div>

      {error && (
        <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {sectorForm && (
        <div className="bg-surface border border-border rounded-xl p-4 mb-4">
          <div className="flex gap-3 items-center">
            <TextField
              aria-label="Sector name"
              className="flex-1"
              value={sectorForm.name}
              onChange={(name) => setSectorForm({ ...sectorForm, name })}
            >
              <Input placeholder="Sector name, e.g. Living Expenses" />
            </TextField>
            <Select
              aria-label="Kind"
              className="w-44"
              value={sectorForm.kind}
              onChange={(value) =>
                setSectorForm({ ...sectorForm, kind: value as CategoryKind })
              }
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {KINDS.map((k) => (
                    <ListBox.Item
                      key={k.value}
                      id={k.value}
                      textValue={k.label}
                    >
                      {k.label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <Button
              isDisabled={busy || !sectorForm.name.trim()}
              onPress={() =>
                create({
                  name: sectorForm.name.trim(),
                  parent_id: null,
                  kind: sectorForm.kind,
                })
              }
            >
              Add sector
            </Button>
          </div>
          <p className="text-xs text-muted mt-2">
            {KINDS.find((k) => k.value === sectorForm.kind)?.hint}. Everything
            inside inherits this, so a sub-category can never contradict its
            sector.
          </p>
        </div>
      )}

      {kindGroups.map((group) => (
        <div key={group.kind.value} className="mb-8 last:mb-0">
          <div className="flex items-baseline gap-2 mb-2">
            <h3 className="text-sm font-medium text-foreground">
              {group.kind.heading}
            </h3>
            <span className="text-xs text-muted">{group.kind.hint}</span>
          </div>
          <div className="space-y-4">
            {group.sectors.map((rows) => {
              const root = rows[0];
              return (
                <div
                  key={root.id}
                  className="bg-surface border border-border rounded-xl overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-border text-sm font-medium text-foreground">
                    {root.name}
                  </div>
                  {rows.map((c) => (
                    <div
                      key={c.id}
                      className="border-b border-border last:border-0"
                    >
                      <div className="group flex items-center gap-3 px-4 py-2.5">
                        <div
                          className="flex-1 min-w-0 text-sm text-foreground truncate"
                          style={{ paddingLeft: `${(c.depth - 1) * 16}px` }}
                        >
                          {renamingId === c.id ? (
                            <div className="flex gap-2 items-center">
                              <TextField
                                aria-label="New name"
                                className="flex-1"
                                value={renameName}
                                onChange={setRenameName}
                              >
                                <Input />
                              </TextField>
                              <Button
                                size="sm"
                                isDisabled={busy || !renameName.trim()}
                                onPress={() =>
                                  run(() =>
                                    api.categories.rename(
                                      c.id,
                                      renameName.trim(),
                                    ),
                                  )
                                }
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="tertiary"
                                onPress={closeForms}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <>
                              {c.depth > 1 && (
                                <span className="text-muted mr-1.5">└</span>
                              )}
                              {c.name}
                              {!c.is_leaf && (
                                <span className="ml-2 text-xs text-muted">
                                  sector
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        <span className="text-xs font-mono text-muted whitespace-nowrap">
                          {c.transaction_count}
                        </span>
                        {renamingId !== c.id && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {c.depth < MAX_DEPTH && (
                              <Button
                                size="sm"
                                variant="tertiary"
                                isDisabled={busy}
                                onPress={() => {
                                  closeForms();
                                  setAddingTo(c.id);
                                }}
                              >
                                Add sub
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="tertiary"
                              isDisabled={busy}
                              onPress={() => {
                                closeForms();
                                setRenamingId(c.id);
                                setRenameName(c.name);
                              }}
                            >
                              Rename
                            </Button>
                            <Button
                              size="sm"
                              variant="danger-soft"
                              isDisabled={busy}
                              onPress={() => {
                                closeForms();
                                setConfirmingId(c.id);
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        )}
                      </div>

                      {addingTo === c.id && (
                        <div
                          className="flex gap-2 items-center px-4 pb-3"
                          style={{ paddingLeft: `${16 + c.depth * 16}px` }}
                        >
                          <TextField
                            aria-label="Sub-category name"
                            className="flex-1"
                            value={childName}
                            onChange={setChildName}
                          >
                            <Input
                              placeholder={`New sub-category in ${c.name}`}
                            />
                          </TextField>
                          <Button
                            size="sm"
                            isDisabled={busy || !childName.trim()}
                            onPress={() =>
                              create({
                                name: childName.trim(),
                                parent_id: c.id,
                              })
                            }
                          >
                            Add
                          </Button>
                          <Button
                            size="sm"
                            variant="tertiary"
                            onPress={closeForms}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}

                      {confirmingId === c.id && (
                        <div
                          className="px-4 pb-3 text-xs text-muted"
                          style={{ paddingLeft: `${16 + c.depth * 16}px` }}
                        >
                          {childCount(c.id) > 0 ? (
                            <div className="flex gap-3 items-center">
                              <span>
                                {c.name} still has {childCount(c.id)}{" "}
                                sub-categor
                                {childCount(c.id) === 1 ? "y" : "ies"}. Delete
                                or move those first, so nothing is silently
                                reparented.
                              </span>
                              <Button
                                size="sm"
                                variant="tertiary"
                                onPress={closeForms}
                              >
                                OK
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-3 items-center">
                              <span>
                                Delete {c.name}?{" "}
                                {c.transaction_count === 0
                                  ? "Nothing is filed against it."
                                  : `Its ${c.transaction_count} transaction${
                                      c.transaction_count === 1 ? "" : "s"
                                    } move to ${c.parent_name ?? "uncategorized"}.`}
                              </span>
                              <Button
                                size="sm"
                                variant="danger-soft"
                                isDisabled={busy}
                                onPress={() =>
                                  run(() => api.categories.remove(c.id))
                                }
                              >
                                Delete
                              </Button>
                              <Button
                                size="sm"
                                variant="tertiary"
                                onPress={closeForms}
                              >
                                Cancel
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
