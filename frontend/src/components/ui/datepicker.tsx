import * as React from "react";
import { format, parseISO } from "date-fns";
import * as Popover from "@radix-ui/react-popover";
import { Calendar } from "./calendar";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = value ? parseISO(value) : undefined;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={cn(
            "h-9 rounded-md border border-border bg-muted px-3 text-sm text-left outline-none transition-colors hover:border-border-hover flex items-center gap-2",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span>📅</span>
          {value ? format(parseISO(value), "MMM d, yyyy") : placeholder}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 bg-muted border border-border rounded-xl shadow-xl p-0"
          align="start"
          sideOffset={4}
        >
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => {
              if (date) {
                onChange(format(date, "yyyy-MM-dd"));
                setOpen(false);
              }
            }}
            initialFocus
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
