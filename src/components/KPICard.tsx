import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { memo } from "react";

interface KPICardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export const KPICard = memo(function KPICard({ label, value, hint, icon: Icon, trend, className }: KPICardProps) {
  const trendColor = {
    up: "text-success",
    down: "text-destructive",
    neutral: "text-muted-foreground",
  }[trend || "neutral"];

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : null;

  return (
    <Card className={cn("metric-card glass-lift overflow-hidden", className)}>
      <CardContent className="relative min-h-[8.25rem] p-5">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/[0.7] to-transparent" />
        <div className="flex min-h-full flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 text-[11px] font-semibold uppercase leading-snug tracking-normal text-muted-foreground">{label}</p>
            {Icon && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-primary/15 bg-primary/[0.08] text-primary shadow-[inset_0_1px_0_hsl(0_0%_100%/0.18)]">
                <Icon className="h-4 w-4" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="metric-value tabular-nums">{value}</p>
          </div>
        </div>
        {hint && (
          <div className={cn("mt-3 flex min-w-0 items-center gap-1 text-xs font-semibold leading-tight", trendColor)}>
            {TrendIcon && <TrendIcon className="h-3.5 w-3.5 shrink-0" />}
            <span className="min-w-0 truncate">{hint}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
