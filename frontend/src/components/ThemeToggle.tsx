import { useTheme } from "@/contexts/ThemeContext";
import { Select } from "@/components/ui/select";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="theme-select" className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
        Theme
      </label>
      <Select
        id="theme-select"
        value={theme}
        onChange={(e) => setTheme(e.target.value as "light" | "dark" | "system")}
        className="w-32"
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </Select>
    </div>
  );
}
