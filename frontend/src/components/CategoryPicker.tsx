import { useMemo } from "react";
import { ComboBox, Header, Input, ListBox } from "@heroui/react";
import { FlatCategory } from "../api/client";

type Props = {
  categories: FlatCategory[];
  /** Null renders as empty, so the same control serves "assign" and "change". */
  value?: number | null;
  onSelect: (categoryId: number) => void;
  isDisabled?: boolean;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
};

/**
 * Type-to-filter beats a 41-item dropdown for something used once per
 * transaction. Options are grouped under their sector and a sub-category shows
 * its ancestry, so picking a parent deliberately is distinguishable from
 * picking a leaf.
 */
export function CategoryPicker({
  categories,
  value,
  onSelect,
  isDisabled = false,
  placeholder = "Search categories",
  className = "w-56",
  ariaLabel = "Category",
}: Props) {
  // Grouped by sector, each group ordered by the tree path so a parent always
  // precedes its children.
  const sectors = useMemo(() => {
    const bySector = new Map<string, FlatCategory[]>();
    for (const c of [...categories].sort((a, b) => a.path.localeCompare(b.path))) {
      const list = bySector.get(c.root_name) ?? [];
      list.push(c);
      bySector.set(c.root_name, list);
    }
    return [...bySector.entries()];
  }, [categories]);

  return (
    <ComboBox
      aria-label={ariaLabel}
      className={className}
      isDisabled={isDisabled}
      selectedKey={value != null ? String(value) : null}
      onSelectionChange={(key) => key != null && onSelect(Number(key))}
    >
      <ComboBox.InputGroup>
        <Input placeholder={placeholder} />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox>
          {sectors.map(([sector, items]) => (
            <ListBox.Section key={sector}>
              <Header>{sector}</Header>
              {items.map((c) => (
                <ListBox.Item
                  key={c.id}
                  id={String(c.id)}
                  // Filtering matches on this, so the full path is searchable:
                  // typing "food" finds "Living Expenses > Food > Groceries".
                  textValue={c.path}
                >
                  <span style={{ paddingLeft: `${(c.depth - 1) * 12}px` }}>
                    {c.name}
                    {!c.is_leaf && (
                      <span className="ml-2 text-xs text-muted">
                        whole sector
                      </span>
                    )}
                  </span>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox.Section>
          ))}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
}
