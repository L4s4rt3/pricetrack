import { useMemo, useState } from "react";
import { RotateCcw, Search } from "lucide-react";
import { FilterField, FilterPanel } from "@/components/FilterPanel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { campaignLabel, formatEur, formatKg, formatNum, MONTHS } from "@/lib/format";
import {
  getCampaignStart,
  getClientLabel,
  getClientSearchText,
  getLineClassification,
  isVisibleRow,
  weightedPrice,
} from "@/lib/parsers";
import type { LineClassification, PrecioRow } from "@/lib/types";

export interface EnrichedPrecio extends PrecioRow {
  cls: LineClassification;
  campaign: number;
  clientLabel: string;
  searchText: string;
  searchKey: string;
}

export interface SaleFilters {
  search: string;
  campaign: string;
  month: string;
  cliente: string;
  type: string;
  base: string;
  variety: string;
  caliber: string;
  format: string;
  subproduct: string;
}

export const initialSaleFilters: SaleFilters = {
  search: "",
  campaign: "",
  month: "",
  cliente: "",
  type: "",
  base: "",
  variety: "",
  caliber: "",
  format: "",
  subproduct: "",
};

const enrichedRowsCache = new WeakMap<PrecioRow[], EnrichedPrecio[]>();

function saleNaturalKey(row: PrecioRow) {
  return [
    row.documento,
    row.factura,
    row.lin,
    row.referencia,
    row.product,
    row.kilos,
    row.base_iva,
  ].join("§");
}

export function useEnrichedPrecios(rows?: PrecioRow[]) {
  return useMemo(
    () => {
      if (!rows?.length) return [];
      const cached = enrichedRowsCache.get(rows);
      if (cached) return cached;

      const seen = new Set<string>();
      const enriched: EnrichedPrecio[] = [];

      rows.forEach((row) => {
        if (!isVisibleRow(row)) return;

        const key = saleNaturalKey(row);
        if (seen.has(key)) return;
        seen.add(key);

          const cls = getLineClassification(row);
          const clientLabel = getClientLabel(row);
          const searchText = [
            row.product,
            row.category,
            row.referencia,
            row.documento,
            row.factura,
            getClientSearchText(row),
            cls.type,
            cls.product,
            cls.variety,
            cls.caliber,
            cls.format,
            cls.subproduct,
          ].join(" ");

          enriched.push({
            ...row,
            cls,
            campaign: getCampaignStart(row),
            clientLabel,
            searchText,
            searchKey: searchText.toLowerCase(),
          });
        });

      enrichedRowsCache.set(rows, enriched);
      return enriched;
    },
    [rows]
  );
}

export function useSaleFilterState() {
  return useState<SaleFilters>(initialSaleFilters);
}

export function selectOptions(rows: EnrichedPrecio[], pick: (row: EnrichedPrecio) => string | number | null | undefined) {
  return Array.from(new Set(rows.map(pick).filter((value) => value !== "" && value !== null && value !== undefined)))
    .map(String)
    .sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
}

export function filterSales(rows: EnrichedPrecio[], filters: SaleFilters) {
  const search = filters.search.trim().toLowerCase();
  return rows.filter((row) => {
    if (search && !row.searchKey.includes(search)) return false;
    if (filters.campaign && String(row.campaign) !== filters.campaign) return false;
    if (filters.month && String(row.month ?? "") !== filters.month) return false;
    if (filters.cliente && row.clientLabel !== filters.cliente) return false;
    if (filters.type && row.cls.type !== filters.type) return false;
    if (filters.base && row.cls.product !== filters.base) return false;
    if (filters.variety && row.cls.variety !== filters.variety) return false;
    if (filters.caliber && row.cls.caliber !== filters.caliber) return false;
    if (filters.format && row.cls.format !== filters.format) return false;
    if (filters.subproduct && row.cls.subproduct !== filters.subproduct) return false;
    return true;
  });
}

export function isProductPriceRow(row: EnrichedPrecio) {
  return row.cls.type === "Producto";
}

export function productPriceRows(rows: EnrichedPrecio[]) {
  return rows.filter(isProductPriceRow);
}

export function productWeightedPrice(rows: EnrichedPrecio[]) {
  return weightedPrice(productPriceRows(rows));
}

export function SaleFilterPanel({
  rows,
  filters,
  onChange,
  compact = false,
}: {
  rows: EnrichedPrecio[];
  filters: SaleFilters;
  onChange: (filters: SaleFilters) => void;
  compact?: boolean;
}) {
  const set = (key: keyof SaleFilters, value: string) => onChange({ ...filters, [key]: value });
  const optionSets = useMemo(
    () => ({
      campaigns: selectOptions(rows, (row) => row.campaign).sort((a, b) => Number(b) - Number(a)),
      months: selectOptions(rows, (row) => row.month),
      clients: selectOptions(rows, (row) => row.clientLabel),
      types: selectOptions(rows, (row) => row.cls.type),
      products: selectOptions(rows, (row) => row.cls.product),
      varieties: selectOptions(rows, (row) => row.cls.variety),
      calibers: selectOptions(rows, (row) => row.cls.caliber),
      formats: selectOptions(rows, (row) => row.cls.format),
      subproducts: selectOptions(rows, (row) => row.cls.subproduct),
    }),
    [rows]
  );

  return (
    <FilterPanel title="Filtros" meta={`${formatNum(rows.length)} lineas`}>
      <FilterField label="Busqueda">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" value={filters.search} onChange={(event) => set("search", event.target.value)} />
        </div>
      </FilterField>
      <SelectFilter label="Campana" value={filters.campaign} options={optionSets.campaigns} format={(v) => campaignLabel(Number(v))} onChange={(v) => set("campaign", v)} />
      <SelectFilter label="Mes" value={filters.month} options={optionSets.months} format={(v) => MONTHS[Number(v) - 1] ?? v} onChange={(v) => set("month", v)} />
      {!compact && <SelectFilter label="Cliente" value={filters.cliente} options={optionSets.clients} onChange={(v) => set("cliente", v)} />}
      <SelectFilter label="Tipo" value={filters.type} options={optionSets.types} onChange={(v) => set("type", v)} />
      <SelectFilter label="Producto" value={filters.base} options={optionSets.products} onChange={(v) => set("base", v)} />
      <SelectFilter label="Variedad" value={filters.variety} options={optionSets.varieties} onChange={(v) => set("variety", v)} />
      {!compact && <SelectFilter label="Calibre" value={filters.caliber} options={optionSets.calibers} onChange={(v) => set("caliber", v)} />}
      {!compact && <SelectFilter label="Formato" value={filters.format} options={optionSets.formats} onChange={(v) => set("format", v)} />}
      {!compact && <SelectFilter label="Subproducto" value={filters.subproduct} options={optionSets.subproducts} onChange={(v) => set("subproduct", v)} />}
      <Button variant="outline" className="filter-reset h-10" onClick={() => onChange(initialSaleFilters)}>
        <RotateCcw className="h-4 w-4" />
        Limpiar
      </Button>
    </FilterPanel>
  );
}

export function SelectFilter({
  label,
  value,
  options,
  onChange,
  format = (v) => v,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  format?: (value: string) => string;
}) {
  return (
    <FilterField label={label}>
      <Select value={value || "__all__"} onValueChange={(v) => onChange(v === "__all__" ? "" : v)}>
        <SelectTrigger className="h-10">
          <SelectValue placeholder="Todos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {format(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  );
}

export function summaryStats(rows: EnrichedPrecio[]) {
  let kg = 0;
  let revenue = 0;
  let productKg = 0;
  let productRevenue = 0;
  const clients = new Set<string>();
  const products = new Set<string>();

  rows.forEach((row) => {
    kg += row.kilos;
    revenue += row.base_iva;
    if (row.clientLabel) clients.add(row.clientLabel);
    if (row.cls.product) products.add(row.cls.product);
    if (isProductPriceRow(row)) {
      productKg += row.kilos;
      productRevenue += row.base_iva;
    }
  });

  return {
    lines: rows.length,
    kg,
    revenue,
    productKg,
    productRevenue,
    otherRevenue: revenue - productRevenue,
    price: productWeightedPrice(rows),
    clients: clients.size,
    products: products.size,
  };
}

export function groupRows<T extends string>(rows: EnrichedPrecio[], getKey: (row: EnrichedPrecio) => T) {
  const map = new Map<T, { name: T; lines: number; refs: Set<string>; kg: number; revenue: number; priceKg: number; priceValue: number }>();
  rows.forEach((row) => {
    const key = getKey(row);
    if (!key) return;
    const current = map.get(key) ?? { name: key, lines: 0, refs: new Set<string>(), kg: 0, revenue: 0, priceKg: 0, priceValue: 0 };
    current.lines += 1;
    current.refs.add(row.referencia);
    current.kg += row.kilos;
    current.revenue += row.base_iva;
    if (isProductPriceRow(row) && row.kilos > 0 && (row.base_iva > 0 || row.price > 0)) {
      current.priceKg += row.kilos;
      current.priceValue += row.base_iva > 0 ? row.base_iva : row.price * row.kilos;
    }
    map.set(key, current);
  });
  return Array.from(map.values())
    .map((item) => ({ ...item, refsCount: item.refs.size, price: item.priceKg > 0 ? item.priceValue / item.priceKg : 0 }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function usePagination<T>(rows: T[], initialPageSize = 50) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  return { page: safePage, pageSize, pageCount, pagedRows, setPage, setPageSize };
}

export function PaginationControls({
  page,
  pageSize,
  pageCount,
  total,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize: (pageSize: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>
        Pagina {page} de {pageCount} · {formatNum(total)} registros
      </span>
      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))}>
          <SelectTrigger className="h-9 w-auto min-w-[70px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[50, 100, 200].map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Anterior
        </Button>
        <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
          Siguiente
        </Button>
      </div>
    </div>
  );
}

export function smallMoney(value: number) {
  return <span className="font-semibold tabular-nums">{formatEur(value)}</span>;
}

export function smallKg(value: number) {
  return <span className="tabular-nums">{formatKg(value)}</span>;
}

export function campaignRows(rows: EnrichedPrecio[], campaign: number) {
  return rows.filter((row) => row.campaign === Number(campaign));
}
