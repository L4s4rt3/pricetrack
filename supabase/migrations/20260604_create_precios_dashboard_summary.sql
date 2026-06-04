CREATE OR REPLACE VIEW public.precios_dashboard_mensual
WITH (security_invoker = on) AS
  SELECT
    make_date(ano::integer, mes::integer, 1) AS month_start,
    ano::integer AS ano,
    mes::integer AS mes,
    count(*)::integer AS lineas,
    count(DISTINCT NULLIF(COALESCE(denominacion_social, cliente, ''), ''))::integer AS clientes,
    count(DISTINCT NULLIF(COALESCE(producto, ''), ''))::integer AS productos,
    COALESCE(sum(kilos), 0)::numeric AS kilos,
    COALESCE(sum(base_iva), 0)::numeric AS facturacion,
    CASE
      WHEN COALESCE(sum(kilos), 0) <> 0 THEN (COALESCE(sum(base_iva), 0) / NULLIF(sum(kilos), 0))::numeric
      ELSE COALESCE(avg(precio), 0)::numeric
    END AS precio_medio,
    now() AS refreshed_at
  FROM public.precios
  WHERE ano >= 2019
    AND mes BETWEEN 1 AND 12
  GROUP BY ano, mes;

GRANT SELECT ON public.precios_dashboard_mensual TO anon, authenticated;
