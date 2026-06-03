import { useEffect, useState } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MIN_CAMPAIGN_START, PRECIOS_SELECT } from "@/lib/campaigns";
import { LONG_LIVED_QUERY_OPTIONS, readPersistentQuery, writePersistentQuery } from "@/lib/persistentQueryCache";
import { getCampaignStart } from "@/lib/parsers";
import type { PrecioRow } from "@/lib/types";

const PAGE_SIZE = 1000;
const PAGE_CONCURRENCY = 3;
const PRECIOS_CACHE_VERSION = "ordered-nulls-last-v2";
export const preciosQueryKey = ["precios", "latest-campaign", MIN_CAMPAIGN_START, PRECIOS_CACHE_VERSION] as const;
export const preciosHistoryQueryKey = ["precios", "full-history", MIN_CAMPAIGN_START, PRECIOS_CACHE_VERSION] as const;

let fullDatasetReady = false;
let historyLoadPromise: Promise<void> | null = null;

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

function sortRows(rows: PrecioRow[]) {
  return [...rows].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    if ((a.month ?? 0) !== (b.month ?? 0)) return (b.month ?? 0) - (a.month ?? 0);
    return b.id - a.id;
  });
}

async function detectLatestCampaign() {
  const latestRows = await supabase
    .from("precios")
    .select("ano,mes")
    .gte("ano", MIN_CAMPAIGN_START)
    .order("ano", { ascending: false })
    .order("mes", { ascending: false, nullsFirst: false })
    .limit(200);

  if (latestRows.error) throw latestRows.error;
  if (!latestRows.data?.length) return new Date().getFullYear();

  return latestRows.data.reduce((latestCampaign, row) => {
    const campaign = getCampaignStart({
      year: Number(row.ano ?? new Date().getFullYear()),
      month: row.mes === null || row.mes === undefined ? null : Number(row.mes),
    });
    return Math.max(latestCampaign, campaign);
  }, MIN_CAMPAIGN_START);
}

function campaignFilter(campaign: number) {
  const nextYear = campaign + 1;
  return [
    `and(ano.eq.${campaign},mes.gte.10)`,
    `and(ano.eq.${nextYear},mes.lte.9)`,
    `and(ano.eq.${nextYear},mes.is.null)`,
  ].join(",");
}

async function fetchCampaignPage(campaign: number, from: number) {
  const to = from + PAGE_SIZE - 1;
  const { data, error } = await supabase
    .from("precios")
    .select(PRECIOS_SELECT)
    .or(campaignFilter(campaign))
    .order("ano", { ascending: false })
    .order("mes", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .range(from, to);

  if (error) throw error;
  return (data ?? []) as unknown as Record<string, unknown>[];
}

async function fetchCampaignFirstPage(campaign: number) {
  const rows = await fetchCampaignPage(campaign, 0);
  return rows.map(normalizeRow);
}

async function fetchCampaignRows(campaign: number) {
  const firstPage = await supabase
    .from("precios")
    .select(PRECIOS_SELECT, { count: "exact" })
    .or(campaignFilter(campaign))
    .order("ano", { ascending: false })
    .order("mes", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .range(0, PAGE_SIZE - 1);

  if (firstPage.error) throw firstPage.error;

  const rows = [...((firstPage.data ?? []) as unknown as Record<string, unknown>[])];
  const total = firstPage.count ?? rows.length;
  const offsets = [];
  for (let from = PAGE_SIZE; from < total; from += PAGE_SIZE) offsets.push(from);

  for (let index = 0; index < offsets.length; index += PAGE_CONCURRENCY) {
    const batch = offsets.slice(index, index + PAGE_CONCURRENCY);
    const pages = await Promise.all(batch.map((from) => fetchCampaignPage(campaign, from)));
    pages.forEach((page) => rows.push(...page));
  }

  return rows.map(normalizeRow);
}

export async function fetchPrecios() {
  const cached = await readPersistentQuery<PrecioRow[]>(preciosQueryKey);
  if (cached) {
    return cached.data;
  }

  const latestCampaign = await detectLatestCampaign();
  const rows = await fetchCampaignFirstPage(latestCampaign);
  void writePersistentQuery(preciosQueryKey, sortRows(rows));
  return rows;
}

async function hydrateOlderCampaigns(queryClient: QueryClient) {
  if (fullDatasetReady || historyLoadPromise) return historyLoadPromise;

  historyLoadPromise = (async () => {
    const cached = await readPersistentQuery<PrecioRow[]>(preciosHistoryQueryKey);
    if (cached) {
      fullDatasetReady = true;
      queryClient.setQueryData(preciosQueryKey, cached.data);
      return;
    }

    const latestCampaign = await detectLatestCampaign();
    const seen = new Set<number>();
    const merged: PrecioRow[] = [];

    const addRows = (rows: PrecioRow[]) => {
      for (const row of rows) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        merged.push(row);
      }
      const sorted = sortRows(merged);
      queryClient.setQueryData(preciosQueryKey, sorted);
      return sorted;
    };

    addRows(queryClient.getQueryData<PrecioRow[]>(preciosQueryKey) ?? []);

    for (let campaign = latestCampaign; campaign >= MIN_CAMPAIGN_START; campaign -= 1) {
      const campaignRows = await fetchCampaignRows(campaign);
      addRows(campaignRows);
    }

    fullDatasetReady = true;
    void writePersistentQuery(preciosHistoryQueryKey, sortRows(merged));
  })().finally(() => {
    historyLoadPromise = null;
  });

  return historyLoadPromise;
}

export function resetPreciosRuntimeState() {
  fullDatasetReady = false;
  historyLoadPromise = null;
}

export function usePrecios({ hydrateHistory = false }: { hydrateHistory?: boolean } = {}) {
  const queryClient = useQueryClient();
  const [isHydratingHistory, setIsHydratingHistory] = useState(false);
  const query = useQuery({
    queryKey: preciosQueryKey,
    queryFn: fetchPrecios,
    ...LONG_LIVED_QUERY_OPTIONS,
  });

  useEffect(() => {
    if (!hydrateHistory || !query.data?.length || fullDatasetReady) return;
    let cancelled = false;
    setIsHydratingHistory(true);
    void hydrateOlderCampaigns(queryClient).finally(() => {
      if (!cancelled) setIsHydratingHistory(false);
    });
    return () => {
      cancelled = true;
    };
  }, [hydrateHistory, query.data?.length, queryClient]);

  return { ...query, isHydratingHistory, isHistoryReady: fullDatasetReady };
}
