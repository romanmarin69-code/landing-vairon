-- Run after creating the VAIRON panel user in Supabase Authentication.
-- This moves admin access to the shared website account and removes other
-- admin profiles.

do $$
declare
  site_admin_id uuid;
begin
  select id
  into site_admin_id
  from auth.users
  where lower(email) = lower('admin@vairon.com');

  if site_admin_id is null then
    raise exception 'Create admin@vairon.com under Authentication > Users first.';
  end if;

  delete from public.profiles
  where id <> site_admin_id;

  insert into public.profiles (id, role)
  values (site_admin_id, 'admin')
  on conflict (id) do update
  set role = excluded.role;
end;
$$;
