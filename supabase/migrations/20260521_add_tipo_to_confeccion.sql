ALTER TABLE ventas_confeccion_detalle ADD COLUMN IF NOT EXISTS tipo text DEFAULT '';
ALTER TABLE ventas_confeccion_detalle ADD COLUMN IF NOT EXISTS pvp_kg numeric DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_confeccion_tipo ON ventas_confeccion_detalle (tipo);
