export const C = {
  primary: "#c47a20",
  primaryLight: "#a06818",
  success: "#5a8a4e",
  warning: "#c47a20",
  destructive: "#c44030",
  info: "#5a7a8a",
  muted: "#9a8a7a",
  gold: "#b08030",
  orange: "#c47a20",
  purple: "#8a6a7a",
};

export const CHART_COLORS = {
  exportacion: "#c47a20",
  mercado: "#5a7a8a",
  noExportacion: "#c45a3a",
  noComercial: "#a08030",
  mujeres: "#8a6a7a",
  otro: "#7a7a7a",
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

export const CHART_CURSOR = { fill: "hsl(var(--glass-bg-strong))", stroke: "hsl(var(--glass-border-accent))" };
export const CHART_LINE_CURSOR = { stroke: "hsl(var(--glass-border-accent))", strokeDasharray: "3 3" };

export function activeDotStyle(color: string) {
  return { r: 5, fill: color, stroke: "hsl(var(--glass-bg-strong))", strokeWidth: 2 };
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
    <div className="rounded-xl border border-[hsl(var(--glass-border-accent))] bg-[hsl(var(--glass-bg-solid))] px-3.5 py-2.5 text-xs shadow-[var(--glass-shadow-lg)] backdrop-blur-xl">
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
