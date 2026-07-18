create extension if not exists "pgcrypto";

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  invited_email text,
  role text not null check (role in ('owner', 'member')) default 'member',
  status text not null check (status in ('pending', 'active')) default 'pending',
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  constraint member_identity_required check (user_id is not null or invited_email is not null),
  unique (household_id, user_id),
  unique (household_id, invited_email)
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

create table if not exists public.shared_market_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  quantity text,
  added_by uuid references auth.users(id) on delete set null,
  checked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shared_wishes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  icon text,
  target numeric(12,2) not null check (target > 0),
  saved numeric(12,2) not null default 0 check (saved >= 0),
  owner_id uuid references auth.users(id) on delete set null,
  is_shared boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.module_permissions enable row level security;
alter table public.household_activity enable row level security;
alter table public.shared_market_items enable row level security;
alter table public.shared_wishes enable row level security;

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

create or replace function public.can_edit_household_module(target_household uuid, target_module text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_household_owner(target_household)
    or exists (
      select 1 from public.module_permissions
      where household_id = target_household
        and user_id = auth.uid()
        and module = target_module
        and can_edit = true
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

create policy "members read market"
on public.shared_market_items for select
using (public.is_household_member(household_id) or public.is_household_owner(household_id));

create policy "editors manage market"
on public.shared_market_items for all
using (public.can_edit_household_module(household_id, 'market'))
with check (public.can_edit_household_module(household_id, 'market'));

create policy "members read shared wishes"
on public.shared_wishes for select
using ((public.is_household_member(household_id) or public.is_household_owner(household_id)) and is_shared = true);

create policy "editors manage wishes"
on public.shared_wishes for all
using (public.can_edit_household_module(household_id, 'wishes'))
with check (public.can_edit_household_module(household_id, 'wishes'));

alter publication supabase_realtime add table public.household_members;
alter publication supabase_realtime add table public.module_permissions;
alter publication supabase_realtime add table public.household_activity;
alter publication supabase_realtime add table public.shared_market_items;
alter publication supabase_realtime add table public.shared_wishes;
