CREATE INDEX IF NOT EXISTS idx_precios_ano_mes_id_desc
ON public.precios (ano DESC, mes DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_ventas_confeccion_fecha_id_desc
ON public.ventas_confeccion (fecha DESC, id DESC);
