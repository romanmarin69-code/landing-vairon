-- Run this in the Supabase SQL Editor after creating admin@vairon.com in
-- Authentication > Users.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin'))
);

create table if not exists public.vehicles (
  id text primary key,
  slug text not null unique,
  marca text not null,
  modelo text not null,
  version text not null default '',
  anio integer not null,
  km integer not null default 0,
  precio numeric not null,
  moneda text not null default 'ARS',
  color text not null default '',
  motor text not null default '',
  combustible text not null default 'Nafta',
  transmision text not null default 'Automática',
  cilindrada text not null default '',
  traccion text not null default '',
  descripcion text not null default '',
  equipamiento text[] not null default '{}',
  destacadas text not null default '',
  info text not null default '',
  photos text[] not null default '{}',
  estado text not null default 'ACTIVO' check (estado in ('ACTIVO', 'INACTIVO')),
  publicado boolean not null default false,
  fecha date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

grant select on public.profiles to authenticated;
grant select on public.vehicles to anon, authenticated;
grant insert, update, delete on public.vehicles to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

drop policy if exists "Public can read published active vehicles" on public.vehicles;
create policy "Public can read published active vehicles"
on public.vehicles for select
to anon, authenticated
using (publicado and estado = 'ACTIVO');

drop policy if exists "Admins can read all vehicles" on public.vehicles;
create policy "Admins can read all vehicles"
on public.vehicles for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert vehicles" on public.vehicles;
create policy "Admins can insert vehicles"
on public.vehicles for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update vehicles" on public.vehicles;
create policy "Admins can update vehicles"
on public.vehicles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete vehicles" on public.vehicles;
create policy "Admins can delete vehicles"
on public.vehicles for delete
to authenticated
using (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit)
values ('vehicle-photos', 'vehicle-photos', true, 5242880)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "Public can read vehicle photos" on storage.objects;
create policy "Public can read vehicle photos"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'vehicle-photos');

drop policy if exists "Admins can upload vehicle photos" on storage.objects;
create policy "Admins can upload vehicle photos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'vehicle-photos' and public.is_admin());

drop policy if exists "Admins can update vehicle photos" on storage.objects;
create policy "Admins can update vehicle photos"
on storage.objects for update
to authenticated
using (bucket_id = 'vehicle-photos' and public.is_admin())
with check (bucket_id = 'vehicle-photos' and public.is_admin());

drop policy if exists "Admins can delete vehicle photos" on storage.objects;
create policy "Admins can delete vehicle photos"
on storage.objects for delete
to authenticated
using (bucket_id = 'vehicle-photos' and public.is_admin());

insert into public.profiles (id, role)
select id, 'admin'
from auth.users
where lower(email) = lower('admin@vairon.com')
on conflict (id) do update
set role = excluded.role;
