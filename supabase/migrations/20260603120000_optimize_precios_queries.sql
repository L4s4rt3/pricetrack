CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_precios_ano_mes_id_desc
  ON public.precios (ano DESC, mes DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_precios_categoria_ano_mes_id_desc
  ON public.precios (categoria, ano DESC, mes DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_precios_producto_ano_mes_id_desc
  ON public.precios (producto, ano DESC, mes DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_precios_producto_trgm
  ON public.precios USING gin (producto gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_precios_categoria_trgm
  ON public.precios USING gin (categoria gin_trgm_ops);

CREATE OR REPLACE VIEW public.precios_filter_options
WITH (security_invoker = on) AS
  SELECT 'ano'::text AS tipo, ano::text AS valor
  FROM public.precios
  GROUP BY ano
  UNION ALL
  SELECT 'producto'::text AS tipo, producto::text AS valor
  FROM public.precios
  WHERE producto IS NOT NULL AND btrim(producto) <> ''
  GROUP BY producto
  UNION ALL
  SELECT 'categoria'::text AS tipo, categoria::text AS valor
  FROM public.precios
  WHERE categoria IS NOT NULL AND btrim(categoria) <> ''
  GROUP BY categoria;

CREATE OR REPLACE VIEW public.precios_resumen_mensual
WITH (security_invoker = on) AS
  SELECT
    ano,
    mes,
    producto,
    categoria,
    count(*)::integer AS total_registros,
    avg(precio)::numeric(12, 2) AS precio_medio,
    min(precio)::numeric(12, 2) AS precio_minimo,
    max(precio)::numeric(12, 2) AS precio_maximo,
    max(created_at) AS refreshed_at
  FROM public.precios
  GROUP BY ano, mes, producto, categoria;
