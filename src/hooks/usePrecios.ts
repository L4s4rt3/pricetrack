import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MIN_CAMPAIGN_START, PRECIOS_SELECT } from "@/lib/campaigns";
import { LONG_LIVED_QUERY_OPTIONS, readPersistentQuery, writePersistentQuery } from "@/lib/persistentQueryCache";
import type { PrecioRow } from "@/lib/types";

const PAGE_SIZE = 1000;
const PAGE_CONCURRENCY = 14;
export const preciosQueryKey = ["precios", MIN_CAMPAIGN_START] as const;

function normalizeRow(row: Record<string, unknown>): PrecioRow {
  return {
    id: row.id as number,
    product: (row.producto as string) || "",
    category: (row.categoria as string) || "Sin categoría",
    price: Number(row.precio ?? 0),
    unit: (row.unidad as string) || "kg",
    year: Number(row.ano ?? new Date().getFullYear()),
    month: (row.mes as number) || null,
    notes: (row.notas as string) || "",
    cliente: (row.cliente as string) || "",
    denominacion_social: (row.denominacion_social as string) || "",
    referencia: (row.referencia as string) || "",
    kilos: Number(row.kilos ?? 0),
    unidades: Number(row.unidades ?? 0),
    litros: Number(row.litros ?? 0),
    tarifa: Number(row.tarifa ?? 0),
    coste_adic: Number(row.coste_adic ?? 0),
    base_iva: Number(row.base_iva ?? 0),
    documento: (row.documento as string) || "",
    factura: (row.factura as string) || "",
    fecha_fra: (row.fecha_fra as string) || "",
    lin: Number(row.lin ?? 0),
    created_at: (row.created_at as string) || "",
  };
}

export async function fetchPrecios() {
  const cached = await readPersistentQuery<PrecioRow[]>(preciosQueryKey);
  if (cached) return cached.data;

  const fetchPage = async (from: number) => {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("precios")
      .select(PRECIOS_SELECT)
      .gte("ano", MIN_CAMPAIGN_START)
      .order("ano", { ascending: false })
      .order("mes", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    if (error) throw error;
    return (data ?? []) as unknown as Record<string, unknown>[];
  };

  const firstPage = await supabase
    .from("precios")
    .select(PRECIOS_SELECT, { count: "exact" })
    .gte("ano", MIN_CAMPAIGN_START)
    .order("ano", { ascending: false })
    .order("mes", { ascending: false })
    .order("id", { ascending: false })
    .range(0, PAGE_SIZE - 1);

  if (firstPage.error) throw firstPage.error;

  const rows = [...((firstPage.data ?? []) as unknown as Record<string, unknown>[])];
  const total = firstPage.count ?? rows.length;
  const offsets = [];
  for (let from = PAGE_SIZE; from < total; from += PAGE_SIZE) offsets.push(from);

  for (let index = 0; index < offsets.length; index += PAGE_CONCURRENCY) {
    const batch = offsets.slice(index, index + PAGE_CONCURRENCY);
    const pages = await Promise.all(batch.map(fetchPage));
    pages.forEach((page) => rows.push(...page));
  }

  const normalized = rows.map(normalizeRow);
  void writePersistentQuery(preciosQueryKey, normalized);
  return normalized;
}

export function usePrecios() {
  return useQuery({
    queryKey: preciosQueryKey,
    queryFn: fetchPrecios,
    ...LONG_LIVED_QUERY_OPTIONS,
  });
}
