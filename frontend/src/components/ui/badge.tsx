import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "accent";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-mono font-medium border",
        variant === "default" && "bg-muted text-muted-foreground border-border",
        variant === "accent" && "bg-primary/10 text-primary border-primary/20",
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
