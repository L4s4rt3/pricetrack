import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LONG_LIVED_QUERY_OPTIONS } from "@/lib/persistentQueryCache";

export interface DashboardMonthSummary {
  month_start: string;
  ano: number;
  mes: number | null;
  lineas: number;
  clientes: number;
  productos: number;
  kilos: number;
  facturacion: number;
  precio_medio: number;
  refreshed_at: string | null;
}

export const dashboardSummaryQueryKey = ["precios", "dashboard-summary", "last-6-months"] as const;

export function isMissingDashboardSummarySource(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const maybeError = error as { code?: string; message?: string };
  const message = maybeError.message ?? "";

  return (
    maybeError.code === "42P01" ||
    maybeError.code === "PGRST205" ||
    /precios_dashboard_mensual|schema cache|does not exist|could not find the table/i.test(message)
  );
}

async function fetchDashboardSummary() {
  const { data, error } = await supabase
    .from("precios_dashboard_mensual")
    .select("month_start,ano,mes,lineas,clientes,productos,kilos,facturacion,precio_medio,refreshed_at")
    .order("month_start", { ascending: false })
    .limit(6);

  if (error) {
    if (isMissingDashboardSummarySource(error)) return [];
    throw error;
  }

  return [...(data ?? [])]
    .reverse()
    .map((row) => ({
      month_start: String(row.month_start),
      ano: Number(row.ano),
      mes: row.mes === null || row.mes === undefined ? null : Number(row.mes),
      lineas: Number(row.lineas ?? 0),
      clientes: Number(row.clientes ?? 0),
      productos: Number(row.productos ?? 0),
      kilos: Number(row.kilos ?? 0),
      facturacion: Number(row.facturacion ?? 0),
      precio_medio: Number(row.precio_medio ?? 0),
      refreshed_at: row.refreshed_at ? String(row.refreshed_at) : null,
    })) satisfies DashboardMonthSummary[];
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: dashboardSummaryQueryKey,
    queryFn: fetchDashboardSummary,
    ...LONG_LIVED_QUERY_OPTIONS,
  });
}
