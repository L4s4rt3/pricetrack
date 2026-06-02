import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CONFECCION_SELECT, MIN_CONFECCION_DATE } from "@/lib/campaigns";
import { LONG_LIVED_QUERY_OPTIONS, readPersistentQuery, writePersistentQuery } from "@/lib/persistentQueryCache";
import type { ConfeccionRow } from "@/lib/types";

const PAGE_SIZE = 1000;
const PAGE_CONCURRENCY = 12;
export const confeccionQueryKey = ["confeccion", MIN_CONFECCION_DATE] as const;

/* eslint-disable @typescript-eslint/no-explicit-any */
function normalizeRow(row: Record<string, any>): ConfeccionRow {
  const kgNetos = Number(row.kg_netos ?? 0);
  const total = Number(row.pvp_total ?? row.base_iva ?? 0);
  const sourcePvpKg = Number(row.pvp_kg ?? 0);
  const sourcePvp = Number(row.pvp ?? 0);
  const pvpKg = sourcePvpKg > 0.05 ? sourcePvpKg : sourcePvp > 0.05 ? sourcePvp : kgNetos ? total / kgNetos : 0;
  return {
    id: row.id ?? 0,
    n_palet: row.n_palet ?? row["nº_palet"] ?? "",
    tipo: row.tipo || row.tipo_palet || "",
    producto_confeccionado: row.producto_confeccionado ?? "",
    producto_base: row.producto_base ?? "",
    variedad: row.variedad ?? "",
    calibre: row.calibre ?? "",
    tipo_caja: row.tipo_caja ?? "",
    cajas: Number(row.cajas ?? 0),
    kg_netos: kgNetos,
    kg_facturados: Number(row.kg_facturados ?? 0),
    pvp_kg: pvpKg,
    pvp_total: total || kgNetos * pvpKg || 0,
    cliente_nombre: row.cliente_nombre ?? "",
    denominacion_social: row.denominacion_social ?? "",
    cliente_id: row.cliente_id ?? "",
    situacion: row.situacion ?? "",
    fecha: row.fecha ?? row.fecha_confeccion ?? "",
    lote: row.lote ?? "",
    documento_venta_original: row.documento_venta_original ?? "",
    documento_limpio: row.documento_limpio ?? "",
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function fetchConfeccion() {
  const cached = await readPersistentQuery<ConfeccionRow[]>(confeccionQueryKey);
  if (cached) return cached.data;

  const firstPage = await supabase
    .from("ventas_confeccion_detalle")
    .select(CONFECCION_SELECT, { count: "exact" })
    .gte("fecha_confeccion", MIN_CONFECCION_DATE)
    .order("fecha_confeccion", { ascending: false })
    .order("id", { ascending: false })
    .range(0, PAGE_SIZE - 1);

  if (firstPage.error) throw firstPage.error;

  const rows: Record<string, any>[] = [...(firstPage.data ?? [])];
  const total = firstPage.count ?? rows.length;
  const offsets = [];
  for (let from = PAGE_SIZE; from < total; from += PAGE_SIZE) offsets.push(from);

  const fetchPage = async (from: number) => {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("ventas_confeccion_detalle")
      .select(CONFECCION_SELECT)
      .gte("fecha_confeccion", MIN_CONFECCION_DATE)
      .order("fecha_confeccion", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    if (error) throw error;
    return (data ?? []) as Record<string, any>[];
  };

  for (let index = 0; index < offsets.length; index += PAGE_CONCURRENCY) {
    const batch = offsets.slice(index, index + PAGE_CONCURRENCY);
    const pages = await Promise.all(batch.map(fetchPage));
    pages.forEach((page) => rows.push(...page));
  }

  const normalized = rows.map(normalizeRow);
  void writePersistentQuery(confeccionQueryKey, normalized);
  return normalized;
}

export function useConfeccion() {
  return useQuery({
    queryKey: confeccionQueryKey,
    queryFn: fetchConfeccion,
    ...LONG_LIVED_QUERY_OPTIONS,
  });
}
