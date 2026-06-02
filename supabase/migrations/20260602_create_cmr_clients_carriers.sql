create table if not exists public.cmr_clients (
  id uuid primary key default gen_random_uuid(),
  client_key text not null unique,
  name text not null,
  consignee text not null default '',
  transitario text not null default '',
  country text not null default '',
  default_goods text not null default '',
  is_edeka boolean not null default false,
  source_files text[] not null default '{}',
  occurrences integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cmr_carriers (
  id uuid primary key default gen_random_uuid(),
  carrier_key text not null unique,
  name text not null,
  details text not null default '',
  country text not null default '',
  source_files text[] not null default '{}',
  occurrences integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cmr_clients enable row level security;
alter table public.cmr_carriers enable row level security;

drop policy if exists "CMR clients are readable" on public.cmr_clients;
create policy "CMR clients are readable"
  on public.cmr_clients for select
  to anon, authenticated
  using (true);

drop policy if exists "CMR carriers are readable" on public.cmr_carriers;
create policy "CMR carriers are readable"
  on public.cmr_carriers for select
  to anon, authenticated
  using (true);

create or replace function public.set_cmr_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_cmr_clients_updated_at on public.cmr_clients;
create trigger set_cmr_clients_updated_at
before update on public.cmr_clients
for each row execute function public.set_cmr_updated_at();

drop trigger if exists set_cmr_carriers_updated_at on public.cmr_carriers;
create trigger set_cmr_carriers_updated_at
before update on public.cmr_carriers
for each row execute function public.set_cmr_updated_at();
