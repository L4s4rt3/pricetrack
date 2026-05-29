export interface PrecioRow {
  id: number;
  product: string;
  category: string;
  price: number;
  unit: string;
  year: number;
  month: number | null;
  notes: string;
  cliente: string;
  denominacion_social: string;
  referencia: string;
  kilos: number;
  unidades: number;
  litros: number;
  tarifa: number;
  coste_adic: number;
  base_iva: number;
  documento: string;
  factura: string;
  fecha_fra: string;
  lin: number;
  created_at: string;
}

export interface ConfeccionRow {
  id: number;
  n_palet: string;
  tipo: string;
  producto_confeccionado: string;
  producto_base: string;
  variedad: string;
  calibre: string;
  tipo_caja: string;
  cajas: number;
  kg_netos: number;
  kg_facturados: number;
  pvp_kg: number;
  pvp_total: number;
  cliente_nombre: string;
  denominacion_social: string;
  cliente_id: string;
  situacion: string;
  fecha: string;
  lote: string;
  documento_venta_original: string;
  documento_limpio: string;
}

export interface LineClassification {
  type: string;
  product: string;
  citrusType: string;
  variety: string;
  caliber: string;
  quality: string;
  format: string;
  formatDetail: string;
  packaging: string;
  container: string;
  brand: string;
  subproduct: string;
}

export interface VentasFilters {
  search: string;
  campaign: number | null;
  month: number | null;
  cliente: string;
  type: string;
  base: string;
  subproduct: string;
  variety: string;
  caliber: string;
  format: string;
}

export interface ProductFilters {
  type: string;
  base: string;
  subproduct: string;
  variety: string;
  caliber: string;
  format: string;
}

export interface PaginationState {
  page: number;
  pageSize: number;
}
