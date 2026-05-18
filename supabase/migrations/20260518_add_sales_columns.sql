-- Extend precios table with full sales tracking fields (ventas.csv support)
ALTER TABLE precios
  ADD COLUMN IF NOT EXISTS cliente             TEXT         DEFAULT '',
  ADD COLUMN IF NOT EXISTS denominacion_social TEXT         DEFAULT '',
  ADD COLUMN IF NOT EXISTS referencia          TEXT         DEFAULT '',
  ADD COLUMN IF NOT EXISTS kilos               NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unidades            NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS litros              NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tarifa              NUMERIC(10,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coste_adic          NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_iva            NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS documento           TEXT         DEFAULT '',
  ADD COLUMN IF NOT EXISTS factura             TEXT         DEFAULT '',
  ADD COLUMN IF NOT EXISTS fecha_fra           TEXT         DEFAULT '',
  ADD COLUMN IF NOT EXISTS lin                 INTEGER      DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_precios_cliente       ON precios (cliente);
CREATE INDEX IF NOT EXISTS idx_precios_referencia    ON precios (referencia);
CREATE INDEX IF NOT EXISTS idx_precios_denominacion  ON precios (denominacion_social);
