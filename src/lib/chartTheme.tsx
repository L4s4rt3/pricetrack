export const C = {
  primary: "#E8EEF2",
  primaryLight: "#F8FBFF",
  success: "#8ED9BE",
  warning: "#C9A65A",
  destructive: "#D06F6A",
  info: "#A9D8EA",
  muted: "#8F98A3",
  silver: "#C9D0D6",
  ice: "#EAF7FF",
  graphite: "#5E6670",
};

export const CHART_COLORS = {
  exportacion: "#E8EEF2",
  mercado: "#A9D8EA",
  noExportacion: "#D06F6A",
  noComercial: "#C9A65A",
  mujeres: "#C9D0D6",
  otro: "#8F98A3",
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
  stroke: "hsl(var(--glass-border-accent))",
  strokeDasharray: "3 8",
};

export const XAXIS = {
  fontSize: 10,
  tick: { fill: "hsl(var(--muted-foreground))", letterSpacing: 0 },
  axisLine: false,
  tickLine: false,
};

export const YAXIS = {
  fontSize: 10,
  tick: { fill: "hsl(var(--muted-foreground))", letterSpacing: 0 },
  axisLine: false,
  tickLine: false,
  width: 40,
};

export const MARGIN = { top: 12, right: 12, bottom: 6, left: 4 };

export const BAR_STYLE = {
  radius: [8, 8, 3, 3] as [number, number, number, number],
  maxBarSize: 28,
};

export const PIE_STYLE = {
  paddingAngle: 2,
};

export const CHART_CURSOR = { fill: "hsl(var(--glass-bg-strong))", stroke: "hsl(var(--glass-border-accent))" };
export const CHART_LINE_CURSOR = { stroke: "hsl(var(--glass-border-accent))", strokeDasharray: "3 3" };

export function activeDotStyle(color: string) {
  return { r: 5, fill: color, stroke: "hsl(var(--background))", strokeWidth: 2 };
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
    <div className="relative overflow-hidden rounded-[8px] border border-[hsl(var(--glass-border-accent))] bg-[hsl(var(--glass-bg-solid))] px-3.5 py-2.5 text-xs shadow-[var(--glass-shadow-lg)] backdrop-blur-2xl">
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--primary))] to-transparent opacity-70" />
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
