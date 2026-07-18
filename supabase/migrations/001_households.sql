create extension if not exists "pgcrypto";

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  invited_email text,
  role text not null check (role in ('owner', 'member')) default 'member',
  status text not null check (status in ('pending', 'active')) default 'pending',
  joined_at timestamptz,
  primary key (household_id, user_id)
);

create table if not exists public.module_permissions (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  module text not null check (module in ('market', 'wishes', 'noor')),
  can_view boolean not null default true,
  can_edit boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (household_id, user_id, module)
);

create table if not exists public.household_activity (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.module_permissions enable row level security;
alter table public.household_activity enable row level security;

create or replace function public.is_household_member(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.is_household_owner(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.households
    where id = target_household and owner_id = auth.uid()
  );
$$;

create policy "members can read household"
on public.households for select
using (public.is_household_member(id) or owner_id = auth.uid());

create policy "owners manage household"
on public.households for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "members can read membership"
on public.household_members for select
using (public.is_household_member(household_id) or public.is_household_owner(household_id));

create policy "owners manage members"
on public.household_members for all
using (public.is_household_owner(household_id))
with check (public.is_household_owner(household_id));

create policy "members can read permissions"
on public.module_permissions for select
using (public.is_household_member(household_id) or public.is_household_owner(household_id));

create policy "owners manage permissions"
on public.module_permissions for all
using (public.is_household_owner(household_id))
with check (public.is_household_owner(household_id));

create policy "members can read activity"
on public.household_activity for select
using (public.is_household_member(household_id) or public.is_household_owner(household_id));

create policy "active members create activity"
on public.household_activity for insert
with check (public.is_household_member(household_id) or public.is_household_owner(household_id));

alter publication supabase_realtime add table public.household_members;
alter publication supabase_realtime add table public.module_permissions;
alter publication supabase_realtime add table public.household_activity;
