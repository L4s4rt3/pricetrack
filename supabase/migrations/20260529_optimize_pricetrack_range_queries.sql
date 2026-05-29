CREATE INDEX IF NOT EXISTS idx_precios_ano_mes_id_desc
ON public.precios (ano DESC, mes DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_ventas_confeccion_detalle_fecha_id_desc
ON public.ventas_confeccion_detalle (fecha_confeccion DESC, id DESC);
