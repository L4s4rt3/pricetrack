create table if not exists public.route_clients (
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

create table if not exists public.route_carriers (
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

alter table public.route_clients enable row level security;
alter table public.route_carriers enable row level security;

drop policy if exists "Route clients are readable" on public.route_clients;
create policy "Route clients are readable"
  on public.route_clients for select
  to anon, authenticated
  using (true);

drop policy if exists "Route carriers are readable" on public.route_carriers;
create policy "Route carriers are readable"
  on public.route_carriers for select
  to anon, authenticated
  using (true);

drop trigger if exists set_route_clients_updated_at on public.route_clients;
create trigger set_route_clients_updated_at
before update on public.route_clients
for each row execute function public.set_cmr_updated_at();

drop trigger if exists set_route_carriers_updated_at on public.route_carriers;
create trigger set_route_carriers_updated_at
before update on public.route_carriers
for each row execute function public.set_cmr_updated_at();
