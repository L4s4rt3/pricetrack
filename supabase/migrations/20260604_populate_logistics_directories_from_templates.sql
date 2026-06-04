create extension if not exists unaccent with schema extensions;

with cmr_source as (
  select
    name,
    original_path,
    regexp_split_to_array(
      trim(regexp_replace(regexp_replace(regexp_replace(name, '^CMR[- ]*', '', 'i'), '^\d{1,6}[- ]*', ''), '^Gemperle\s+\d+', 'Gemperle', 'i')),
      '\s*-\s*'
    ) as parts
  from public.logistics_templates
  where kind = 'cmr'
),
cmr_clients_source as (
  select
    trim(parts[1]) as name,
    original_path
  from cmr_source
  where array_length(parts, 1) >= 1
    and trim(parts[1]) <> ''
),
cmr_clients_normalized as (
  select
    trim(both '-' from regexp_replace(lower(extensions.unaccent(name)), '[^a-z0-9]+', '-', 'g')) as client_key,
    name,
    original_path
  from cmr_clients_source
),
cmr_clients_grouped as (
  select
    client_key,
    (array_agg(name order by length(name) desc, name))[1] as name,
    count(*)::integer as occurrences,
    (array_agg(original_path order by original_path))[1:30] as source_files
  from cmr_clients_normalized
  group by client_key
),
cmr_carriers_source as (
  select
    case
      when array_length(parts, 1) <= 1 then ''
      when upper(trim(parts[array_length(parts, 1)])) in ('ALEMANIA', 'BILBAO', 'GRAN BRETAÑA', 'LILLE', 'LONDRES', 'LYON', 'MADRID', 'PARIS', 'POLONIA', 'PORTUGAL', 'RUNGIS')
        and array_length(parts, 1) > 2
        then trim(parts[array_length(parts, 1) - 1])
      else trim(parts[array_length(parts, 1)])
    end as name,
    original_path
  from cmr_source
),
cmr_carriers_normalized as (
  select
    trim(both '-' from regexp_replace(lower(extensions.unaccent(name)), '[^a-z0-9]+', '-', 'g')) as carrier_key,
    name,
    original_path
  from cmr_carriers_source
  where name <> ''
),
cmr_carriers_grouped as (
  select
    carrier_key,
    (array_agg(name order by length(name) desc, name))[1] as name,
    count(*)::integer as occurrences,
    (array_agg(original_path order by original_path))[1:30] as source_files
  from cmr_carriers_normalized
  group by carrier_key
)
insert into public.cmr_clients (client_key, name, default_goods, is_edeka, source_files, occurrences)
select client_key, name, 'PALETS DE NARANJAS', name ilike '%edeka%', source_files, occurrences
from cmr_clients_grouped
where client_key <> ''
on conflict (client_key) do update set
  name = excluded.name,
  default_goods = excluded.default_goods,
  is_edeka = excluded.is_edeka,
  source_files = excluded.source_files,
  occurrences = excluded.occurrences,
  updated_at = now();

with cmr_source as (
  select
    name,
    original_path,
    regexp_split_to_array(
      trim(regexp_replace(regexp_replace(regexp_replace(name, '^CMR[- ]*', '', 'i'), '^\d{1,6}[- ]*', ''), '^Gemperle\s+\d+', 'Gemperle', 'i')),
      '\s*-\s*'
    ) as parts
  from public.logistics_templates
  where kind = 'cmr'
),
cmr_carriers_source as (
  select
    case
      when array_length(parts, 1) <= 1 then ''
      when upper(trim(parts[array_length(parts, 1)])) in ('ALEMANIA', 'BILBAO', 'GRAN BRETAÑA', 'LILLE', 'LONDRES', 'LYON', 'MADRID', 'PARIS', 'POLONIA', 'PORTUGAL', 'RUNGIS')
        and array_length(parts, 1) > 2
        then trim(parts[array_length(parts, 1) - 1])
      else trim(parts[array_length(parts, 1)])
    end as name,
    original_path
  from cmr_source
),
cmr_carriers_normalized as (
  select
    trim(both '-' from regexp_replace(lower(extensions.unaccent(name)), '[^a-z0-9]+', '-', 'g')) as carrier_key,
    name,
    original_path
  from cmr_carriers_source
  where name <> ''
),
cmr_carriers_grouped as (
  select
    carrier_key,
    (array_agg(name order by length(name) desc, name))[1] as name,
    count(*)::integer as occurrences,
    (array_agg(original_path order by original_path))[1:30] as source_files
  from cmr_carriers_normalized
  group by carrier_key
)
insert into public.cmr_carriers (carrier_key, name, details, source_files, occurrences)
select carrier_key, name, name, source_files, occurrences
from cmr_carriers_grouped
where carrier_key <> ''
on conflict (carrier_key) do update set
  name = excluded.name,
  details = excluded.details,
  source_files = excluded.source_files,
  occurrences = excluded.occurrences,
  updated_at = now();

with route_source as (
  select
    name,
    original_path,
    trim(regexp_replace(regexp_replace(name, '[- ]+\d{6,8}$', ''), '[- ]+0?\d{1,2}[.]\d{1,2}[.]\d{2,4}$', '')) as base,
    regexp_split_to_array(trim(regexp_replace(regexp_replace(name, '[- ]+\d{6,8}$', ''), '[- ]+0?\d{1,2}[.]\d{1,2}[.]\d{2,4}$', '')), '\s*-\s*') as parts
  from public.logistics_templates
  where kind = 'route'
),
route_clients_source as (
  select
    case
      when array_length(parts, 1) > 1 then trim(parts[1])
      when upper(base) ~ '\s(SERVICOM|TRANSGUISER|BLAZQUEZ|MONTIEL|VILLASAB|ACOTRAL|GENARO|TRILLO|KIKITO|KINI|HAYA|RLC)$'
        then trim(regexp_replace(base, '\s(SERVICOM|TRANSGUISER|BLAZQUEZ|MONTIEL|VILLASAB|ACOTRAL|GENARO|TRILLO|KIKITO|KINI|HAYA|RLC)$', '', 'i'))
      else trim(base)
    end as name,
    original_path
  from route_source
),
route_clients_normalized as (
  select
    trim(both '-' from regexp_replace(lower(extensions.unaccent(name)), '[^a-z0-9]+', '-', 'g')) as client_key,
    name,
    original_path
  from route_clients_source
  where name <> ''
),
route_clients_grouped as (
  select
    client_key,
    (array_agg(name order by length(name) desc, name))[1] as name,
    count(*)::integer as occurrences,
    (array_agg(original_path order by original_path))[1:30] as source_files
  from route_clients_normalized
  group by client_key
)
insert into public.route_clients (client_key, name, default_goods, is_edeka, source_files, occurrences)
select client_key, name, 'PALETS DE NARANJAS', name ilike '%edeka%', source_files, occurrences
from route_clients_grouped
where client_key <> ''
on conflict (client_key) do update set
  name = excluded.name,
  default_goods = excluded.default_goods,
  is_edeka = excluded.is_edeka,
  source_files = excluded.source_files,
  occurrences = excluded.occurrences,
  updated_at = now();

with route_source as (
  select
    name,
    original_path,
    trim(regexp_replace(regexp_replace(name, '[- ]+\d{6,8}$', ''), '[- ]+0?\d{1,2}[.]\d{1,2}[.]\d{2,4}$', '')) as base,
    regexp_split_to_array(trim(regexp_replace(regexp_replace(name, '[- ]+\d{6,8}$', ''), '[- ]+0?\d{1,2}[.]\d{1,2}[.]\d{2,4}$', '')), '\s*-\s*') as parts
  from public.logistics_templates
  where kind = 'route'
),
route_carriers_source as (
  select
    case
      when array_length(parts, 1) > 1 and upper(trim(parts[array_length(parts, 1)])) in ('SERVICOM', 'TRANSGUISER', 'BLAZQUEZ', 'MONTIEL', 'VILLASAB', 'ACOTRAL', 'GENARO', 'TRILLO', 'KIKITO', 'KINI', 'HAYA', 'RLC')
        then upper(trim(parts[array_length(parts, 1)]))
      when upper(base) ~ '\s(SERVICOM|TRANSGUISER|BLAZQUEZ|MONTIEL|VILLASAB|ACOTRAL|GENARO|TRILLO|KIKITO|KINI|HAYA|RLC)$'
        then substring(upper(base) from '(SERVICOM|TRANSGUISER|BLAZQUEZ|MONTIEL|VILLASAB|ACOTRAL|GENARO|TRILLO|KIKITO|KINI|HAYA|RLC)$')
      else ''
    end as name,
    original_path
  from route_source
),
route_carriers_normalized as (
  select
    trim(both '-' from regexp_replace(lower(extensions.unaccent(name)), '[^a-z0-9]+', '-', 'g')) as carrier_key,
    name,
    original_path
  from route_carriers_source
  where name <> ''
),
route_carriers_grouped as (
  select
    carrier_key,
    (array_agg(name order by length(name) desc, name))[1] as name,
    count(*)::integer as occurrences,
    (array_agg(original_path order by original_path))[1:30] as source_files
  from route_carriers_normalized
  group by carrier_key
)
insert into public.route_carriers (carrier_key, name, details, source_files, occurrences)
select carrier_key, name, name, source_files, occurrences
from route_carriers_grouped
where carrier_key <> ''
on conflict (carrier_key) do update set
  name = excluded.name,
  details = excluded.details,
  source_files = excluded.source_files,
  occurrences = excluded.occurrences,
  updated_at = now();
