import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FilterPanelProps {
  children: ReactNode;
  title?: string;
  meta?: string;
  className?: string;
}

export function FilterPanel({ children, title, meta, className }: FilterPanelProps) {
  return (
    <div className={cn("filter-panel rounded-lg p-4", className)}>
      {(title || meta) && (
        <div className="filter-panel-head">
          {title && <span className="filter-title"><span />{title}</span>}
          {meta && <span className="filter-meta">{meta}</span>}
        </div>
      )}
      <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>
    </div>
  );
}

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label className="text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
