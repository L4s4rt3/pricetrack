CREATE TABLE IF NOT EXISTS ventas_confeccion_detalle (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

  -- Datos del palet / confección (mayo 6.xlsx)
  tipo_palet TEXT,
  nº_palet BIGINT,
  fecha_confeccion DATE,
  producto_confeccionado TEXT,
  lote TEXT,
  documento_venta_original TEXT,
  documento_limpio TEXT,
  fecha_documento DATE,
  cliente_nombre TEXT,
  cajas INTEGER,
  tipo_caja TEXT,
  kg_netos NUMERIC(10,2),
  kg_facturados NUMERIC(10,2),
  situacion TEXT,

  -- Datos de la venta (mayo 2.xlsx)
  cliente_id TEXT,
  cc TEXT,
  denominacion_social TEXT,
  matricula TEXT,
  fecha_fra DATE,
  factura TEXT,
  linea INTEGER,
  referencia TEXT,
  articulo_venta TEXT,
  kilos_venta NUMERIC(10,2),
  unidades INTEGER,
  litros NUMERIC(10,2),
  tarifa NUMERIC(10,2),
  pvp NUMERIC(10,2),
  coste_adic NUMERIC(10,2),
  base_iva NUMERIC(10,2),

  -- Campos parseados del artículo
  producto_base TEXT,
  variedad TEXT,
  calibre TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ventas_confeccion_detalle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON ventas_confeccion_detalle FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON ventas_confeccion_detalle FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON ventas_confeccion_detalle FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON ventas_confeccion_detalle FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_vcd_cliente ON ventas_confeccion_detalle (cliente_nombre);
CREATE INDEX IF NOT EXISTS idx_vcd_producto ON ventas_confeccion_detalle (producto_confeccionado);
CREATE INDEX IF NOT EXISTS idx_vcd_documento ON ventas_confeccion_detalle (documento_limpio);
CREATE INDEX IF NOT EXISTS idx_vcd_palet ON ventas_confeccion_detalle (nº_palet);
CREATE INDEX IF NOT EXISTS idx_vcd_fecha ON ventas_confeccion_detalle (fecha_confeccion);
CREATE INDEX IF NOT EXISTS idx_vcd_calibre ON ventas_confeccion_detalle (calibre);
CREATE INDEX IF NOT EXISTS idx_vcd_tipo_caja ON ventas_confeccion_detalle (tipo_caja);
