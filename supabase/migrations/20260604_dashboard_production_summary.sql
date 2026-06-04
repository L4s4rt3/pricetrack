CREATE OR REPLACE VIEW public.dashboard_produccion_mensual
WITH (security_invoker = on) AS
WITH months AS (
  SELECT DISTINCT date_trunc('month', date)::date AS month_start
  FROM public.partes_diarios
  WHERE date IS NOT NULL
  ORDER BY month_start DESC
  LIMIT 6
),
parts_month AS (
  SELECT
    date_trunc('month', date)::date AS month_start,
    count(*)::integer AS dias,
    max(updated_at) AS refreshed_at
  FROM public.partes_diarios
  WHERE date IS NOT NULL
  GROUP BY 1
),
product_month AS (
  SELECT
    date_trunc('month', part.date)::date AS month_start,
    count(product.*)::integer AS lineas_producto,
    count(DISTINCT NULLIF(product.producto, ''))::integer AS productos,
    count(DISTINCT NULLIF(product.grupo_destino, ''))::integer AS destinos_producto,
    COALESCE(sum(product.kg), 0)::numeric(14, 2) AS kilos_producto,
    COALESCE(sum(product.n_cajas), 0)::numeric(14, 2) AS cajas
  FROM public.partes_diarios part
  JOIN public.producto_dia product
    ON product.part_id = part.id
  WHERE part.date IS NOT NULL
  GROUP BY 1
),
palets_month AS (
  SELECT
    date_trunc('month', part.date)::date AS month_start,
    COALESCE(NULLIF(count(DISTINCT NULLIF(palet.palet_id, '')), 0), count(palet.*))::integer AS palets,
    count(DISTINCT NULLIF(palet.cliente, ''))::integer AS clientes,
    count(DISTINCT NULLIF(palet.destino, ''))::integer AS destinos_palets,
    COALESCE(sum(palet.kg_neto), 0)::numeric(14, 2) AS kilos_palets
  FROM public.partes_diarios part
  JOIN public.palets_dia palet
    ON palet.part_id = part.id
  WHERE part.date IS NOT NULL
  GROUP BY 1
),
lotes_month AS (
  SELECT
    date_trunc('month', part.date)::date AS month_start,
    count(DISTINCT NULLIF(lote.lote_codigo, ''))::integer AS lotes,
    count(DISTINCT NULLIF(lote.productor, ''))::integer AS productores,
    COALESCE(sum(lote.kg_peso_total), 0)::numeric(14, 2) AS kilos_lotes
  FROM public.partes_diarios part
  JOIN public.lotes_dia lote
    ON lote.part_id = part.id
  WHERE part.date IS NOT NULL
  GROUP BY 1
)
SELECT
  months.month_start,
  extract(year FROM months.month_start)::integer AS ano,
  extract(month FROM months.month_start)::integer AS mes,
  COALESCE(product_month.lineas_producto, 0)::integer AS lineas,
  COALESCE(palets_month.clientes, 0)::integer AS clientes,
  COALESCE(product_month.productos, 0)::integer AS productos,
  COALESCE(product_month.kilos_producto, palets_month.kilos_palets, 0)::numeric(14, 2) AS kilos,
  0::numeric(14, 2) AS facturacion,
  0::numeric(12, 4) AS precio_medio,
  COALESCE(parts_month.refreshed_at, now()) AS refreshed_at,
  COALESCE(parts_month.dias, 0)::integer AS dias,
  COALESCE(product_month.cajas, 0)::numeric(14, 2) AS cajas,
  COALESCE(palets_month.palets, 0)::integer AS palets,
  COALESCE(lotes_month.lotes, 0)::integer AS lotes,
  COALESCE(lotes_month.productores, 0)::integer AS productores,
  GREATEST(
    COALESCE(product_month.destinos_producto, 0),
    COALESCE(palets_month.destinos_palets, 0)
  )::integer AS destinos
FROM months
LEFT JOIN parts_month USING (month_start)
LEFT JOIN product_month USING (month_start)
LEFT JOIN palets_month USING (month_start)
LEFT JOIN lotes_month USING (month_start)
ORDER BY months.month_start DESC;

GRANT SELECT ON public.dashboard_produccion_mensual TO anon, authenticated;
