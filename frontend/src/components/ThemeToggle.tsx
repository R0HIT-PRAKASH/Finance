import { ListBox, Select, useTheme } from "@heroui/react";

const THEMES = [
  { id: "system", name: "System" },
  { id: "light", name: "Light" },
  { id: "dark", name: "Dark" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Select
      aria-label="Theme"
      className="w-32"
      value={theme}
      onChange={(value) => value !== null && setTheme(String(value))}
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {THEMES.map((option) => (
            <ListBox.Item key={option.id} id={option.id} textValue={option.name}>
              {option.name}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
