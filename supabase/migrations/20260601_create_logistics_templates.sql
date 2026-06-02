create table if not exists public.logistics_templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('route', 'cmr')),
  name text not null,
  storage_path text not null unique,
  original_path text,
  extension text not null,
  size_bytes bigint,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.logistics_templates enable row level security;

drop policy if exists "Logistics templates are readable" on public.logistics_templates;
create policy "Logistics templates are readable"
on public.logistics_templates
for select
to anon, authenticated
using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logistics-templates',
  'logistics-templates',
  false,
  52428800,
  array[
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Logistics template files are readable" on storage.objects;
create policy "Logistics template files are readable"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'logistics-templates');
