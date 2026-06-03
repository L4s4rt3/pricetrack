CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_precios_cliente_trgm
  ON public.precios USING gin (cliente gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_precios_denominacion_social_trgm
  ON public.precios USING gin (denominacion_social gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_precios_documento_trgm
  ON public.precios USING gin (documento gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_precios_factura_trgm
  ON public.precios USING gin (factura gin_trgm_ops);

CREATE OR REPLACE VIEW public.precios_dashboard_mensual
WITH (security_invoker = on) AS
SELECT
  make_date(ano, COALESCE(NULLIF(mes, 0), 1), 1) AS month_start,
  ano,
  mes,
  count(*)::integer AS lineas,
  count(DISTINCT COALESCE(NULLIF(denominacion_social, ''), NULLIF(cliente, '')))::integer AS clientes,
  count(DISTINCT NULLIF(producto, ''))::integer AS productos,
  COALESCE(sum(kilos), 0)::numeric(14, 2) AS kilos,
  COALESCE(sum(base_iva), 0)::numeric(14, 2) AS facturacion,
  CASE
    WHEN COALESCE(sum(kilos), 0) > 0 THEN (COALESCE(sum(base_iva), 0) / NULLIF(sum(kilos), 0))::numeric(12, 4)
    ELSE avg(precio)::numeric(12, 4)
  END AS precio_medio,
  max(created_at) AS refreshed_at
FROM public.precios
WHERE ano IS NOT NULL
GROUP BY ano, mes;
