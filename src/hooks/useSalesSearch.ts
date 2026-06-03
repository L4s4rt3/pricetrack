import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PRECIOS_SELECT } from "@/lib/campaigns";
import type { PrecioRow } from "@/lib/types";

export interface SalesSearchFilters {
  text: string;
  campaign: string;
  month: string;
  client: string;
  product: string;
}

export interface SalesSearchParams {
  filters: SalesSearchFilters;
  page: number;
  pageSize: number;
}

export function hasSearchCriteria(filters: SalesSearchFilters) {
  return Boolean(filters.text.trim() || filters.campaign || filters.month || filters.client || filters.product);
}

function searchTerm(value: string) {
  return value.trim().replaceAll("%", "\\%").replaceAll("_", "\\_");
}

export function normalizeSearchRow(row: Record<string, unknown>): PrecioRow {
  return {
    id: row.id as number,
    product: (row.producto as string) || "",
    category: (row.categoria as string) || "Sin categoria",
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

export async function fetchSalesSearch({ filters, page, pageSize }: SalesSearchParams) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from("precios")
    .select(PRECIOS_SELECT, { count: "exact" })
    .order("ano", { ascending: false })
    .order("mes", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .range(from, to)
    .limit(pageSize);

  const text = searchTerm(filters.text);
  if (text) {
    const fields = ["producto", "categoria", "cliente", "denominacion_social", "documento", "factura", "referencia"];
    query = query.or(fields.map((field) => `${field}.ilike.%${text}%`).join(","));
  }

  if (filters.campaign) query = query.eq("ano", Number(filters.campaign));
  if (filters.month) query = query.eq("mes", Number(filters.month));

  const client = searchTerm(filters.client);
  if (client) query = query.or(`cliente.ilike.%${client}%,denominacion_social.ilike.%${client}%`);

  const product = searchTerm(filters.product);
  if (product) query = query.or(`producto.ilike.%${product}%,categoria.ilike.%${product}%`);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    rows: (data ?? []).map((row) => normalizeSearchRow(row as Record<string, unknown>)),
    count: count ?? 0,
  };
}

export function useSalesSearch(params: SalesSearchParams) {
  const hasCriteria = hasSearchCriteria(params.filters);

  return useQuery({
    queryKey: ["sales-search", params],
    queryFn: () => fetchSalesSearch(params),
    enabled: hasCriteria,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });
}
