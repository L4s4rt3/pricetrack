export const C = {
  primary: "#01696f",
  primaryLight: "#0c4e54",
  success: "#437a22",
  warning: "#d19900",
  destructive: "#a12c7b",
  info: "#006494",
  muted: "#b0afa9",
  gold: "#d19900",
  orange: "#da7101",
  purple: "#8b5cf6",
};

export const CHART_COLORS = {
  exportacion: "#10b981",
  mercado: "#3b82f6",
  noExportacion: "#f97316",
  noComercial: "#f59e0b",
  mujeres: "#8b5cf6",
  otro: "#94a3b8",
};

export function barFill(color: string, opacity: number): string {
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export const GRID = {
  vertical: false as const,
  stroke: "hsl(var(--border))",
  strokeDasharray: "4 6",
};

export const XAXIS = {
  fontSize: 10,
  tick: { fill: "hsl(var(--muted-foreground))" },
  axisLine: false,
  tickLine: false,
};

export const YAXIS = {
  fontSize: 10,
  tick: { fill: "hsl(var(--muted-foreground))" },
  axisLine: false,
  tickLine: false,
  width: 40,
};

export const MARGIN = { top: 8, right: 8, bottom: 4, left: 4 };

export const BAR_STYLE = {
  radius: [7, 7, 2, 2] as [number, number, number, number],
  maxBarSize: 32,
};

export const PIE_STYLE = {
  paddingAngle: 2,
};

export const CHART_CURSOR = { fill: "var(--glass-bg-strong)", stroke: "var(--glass-border-accent)" };
export const CHART_LINE_CURSOR = { stroke: "var(--glass-border-accent)", strokeDasharray: "3 3" };

export function activeDotStyle(color: string) {
  return { r: 5, fill: color, stroke: "var(--glass-bg-strong)", strokeWidth: 2 };
}

export const CHART_PANEL_CLASS = "chart-panel";

export function GlassTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: { name: string; value: string | number; color: string }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--glass-border-accent)] bg-[var(--glass-bg-strong)] px-3 py-2 text-xs shadow-[var(--glass-shadow-lg)] backdrop-blur-2xl">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-muted-foreground">{item.name}:</span>
          <span className="font-semibold text-foreground">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
