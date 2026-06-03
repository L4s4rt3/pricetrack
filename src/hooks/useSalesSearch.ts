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

export function normalizeSalesSearchFilters(filters: SalesSearchFilters): SalesSearchFilters {
  return {
    text: filters.text.trim(),
    campaign: filters.campaign.trim(),
    month: filters.month.trim(),
    client: filters.client.trim(),
    product: filters.product.trim(),
  };
}

export function hasSearchCriteria(filters: SalesSearchFilters) {
  const normalized = normalizeSalesSearchFilters(filters);
  return Boolean(normalized.text || normalized.campaign || normalized.month || normalized.client || normalized.product);
}

export function postgrestIlikePattern(value: string) {
  const escaped = value.trim().replace(/[\\,%"'()*]/g, "\\$&").replaceAll("_", "\\_");
  return escaped ? `"*${escaped}*"` : "";
}

function parseOptionalInteger(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`${label} debe ser un numero entero.`);
  }

  return Number(trimmed);
}

export function validateSalesSearchFilters(filters: SalesSearchFilters) {
  const campaignNumber = parseOptionalInteger(filters.campaign, "Campana");
  const monthNumber = parseOptionalInteger(filters.month, "Mes");

  if (monthNumber !== undefined && (monthNumber < 1 || monthNumber > 12)) {
    throw new Error("Mes debe estar entre 1 y 12.");
  }

  return { campaignNumber, monthNumber };
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
  const normalizedFilters = normalizeSalesSearchFilters(filters);
  if (!hasSearchCriteria(normalizedFilters)) {
    throw new Error("Introduce texto o filtros para buscar.");
  }

  const { campaignNumber, monthNumber } = validateSalesSearchFilters(normalizedFilters);
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

  const text = postgrestIlikePattern(normalizedFilters.text);
  if (text) {
    const fields = ["producto", "categoria", "cliente", "denominacion_social", "documento", "factura", "referencia"];
    query = query.or(fields.map((field) => `${field}.ilike.${text}`).join(","));
  }

  if (campaignNumber !== undefined) query = query.eq("ano", campaignNumber);
  if (monthNumber !== undefined) query = query.eq("mes", monthNumber);

  const client = postgrestIlikePattern(normalizedFilters.client);
  if (client) query = query.or(`cliente.ilike.${client},denominacion_social.ilike.${client}`);

  const product = postgrestIlikePattern(normalizedFilters.product);
  if (product) query = query.or(`producto.ilike.${product},categoria.ilike.${product}`);

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
