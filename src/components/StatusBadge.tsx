import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusTone = "success" | "warning" | "danger" | "info" | "muted";

interface StatusBadgeProps extends Omit<BadgeProps, "variant"> {
  tone?: StatusTone;
}

export function StatusBadge({ tone = "muted", className, ...props }: StatusBadgeProps) {
  const tones: Record<StatusTone, string> = {
    success: "border-success/20 bg-success/10 text-success",
    warning: "border-warning/20 bg-warning/10 text-warning",
    danger: "border-destructive/20 bg-destructive/10 text-destructive",
    info: "border-primary/20 bg-primary/10 text-primary",
    muted: "border-border bg-muted text-muted-foreground",
  };

  return <Badge variant="outline" className={cn("rounded-xl px-2.5 py-1 font-medium", tones[tone], className)} {...props} />;
}
