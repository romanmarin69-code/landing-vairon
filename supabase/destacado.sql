-- Publicación destacada (portada). Ejecutar una vez en Supabase > SQL Editor.
alter table public.vehicles add column if not exists destacado boolean not null default false;

-- Garantiza que haya una sola publicación destacada a la vez.
create unique index if not exists vehicles_un_solo_destacado
  on public.vehicles (destacado)
  where destacado;
