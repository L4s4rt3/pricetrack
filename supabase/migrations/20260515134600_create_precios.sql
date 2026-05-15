CREATE TABLE IF NOT EXISTS precios (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  producto TEXT NOT NULL,
  categoria TEXT DEFAULT 'Sin categoría',
  precio NUMERIC(10, 2) NOT NULL,
  unidad TEXT DEFAULT '€/ud',
  ano INTEGER NOT NULL,
  mes INTEGER CHECK (mes >= 1 AND mes <= 12),
  notas TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE precios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON precios FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON precios FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON precios FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON precios FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_precios_producto ON precios (producto);
CREATE INDEX IF NOT EXISTS idx_precios_ano ON precios (ano);
CREATE INDEX IF NOT EXISTS idx_precios_categoria ON precios (categoria);
