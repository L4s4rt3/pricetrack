CREATE OR REPLACE FUNCTION public.delete_all_precios()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  SELECT COUNT(*) INTO deleted_count FROM public.precios;
  TRUNCATE TABLE public.precios RESTART IDENTITY;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_all_precios() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
