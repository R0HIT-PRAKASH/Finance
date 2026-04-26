import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-md border border-border bg-muted px-3 py-1 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
