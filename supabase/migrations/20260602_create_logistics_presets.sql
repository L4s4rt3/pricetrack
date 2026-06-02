create table if not exists public.logistics_presets (
  id uuid primary key default gen_random_uuid(),
  preset_key text not null unique,
  name text not null,
  sender text not null default 'LASARTE S.A.T. SE-0037
Ctra. Madrid-Cadiz, km. 461
41400-Ecija (Sevilla)
V-14800304',
  consignee text not null default '',
  carrier text not null default '',
  load_place text not null default 'ECIJA',
  load_country text not null default 'ESPANA',
  delivery_place text not null default '',
  delivery_country text not null default '',
  default_goods text not null default 'PALETS DE NARANJAS',
  default_instructions text not null default 'MERCANCIA PREENFRIADA
TEMPERATURA 5 C',
  source_files text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.logistics_presets enable row level security;

drop policy if exists "Logistics presets are readable" on public.logistics_presets;
create policy "Logistics presets are readable"
  on public.logistics_presets for select
  to anon, authenticated
  using (true);

create or replace function public.set_logistics_presets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_logistics_presets_updated_at on public.logistics_presets;
create trigger set_logistics_presets_updated_at
before update on public.logistics_presets
for each row execute function public.set_logistics_presets_updated_at();
