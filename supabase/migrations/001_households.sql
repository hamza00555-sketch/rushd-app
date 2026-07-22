create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  invited_email text,
  display_name text,
  role text not null check (role in ('owner', 'member')) default 'member',
  status text not null check (status in ('pending', 'active')) default 'pending',
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_identity_required check (user_id is not null or invited_email is not null),
  constraint household_member_identity_unique unique (household_id, user_id),
  constraint household_invited_email_unique unique (household_id, invited_email),
  constraint household_member_composite_unique unique (id, household_id)
);

create table if not exists public.module_permissions (
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid not null,
  module text not null check (module in ('market', 'wishes', 'noor')),
  can_view boolean not null default false,
  can_edit boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (member_id, module),
  constraint permission_member_household_fk foreign key (member_id, household_id)
    references public.household_members(id, household_id) on delete cascade,
  constraint edit_requires_view check (can_edit = false or can_view = true)
);

create table if not exists public.household_activity (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,
  action text not null check (char_length(action) between 2 and 120),
  detail text,
  created_at timestamptz not null default now()
);

create table if not exists public.shared_market_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  quantity text,
  added_by uuid references auth.users(id) on delete set null,
  added_by_name text,
  checked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shared_wishes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  icon text,
  target numeric(12,2) not null check (target > 0),
  saved numeric(12,2) not null default 0 check (saved >= 0),
  deadline_label text,
  owner_id uuid references auth.users(id) on delete set null,
  owner_name text,
  is_shared boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists household_members_user_idx on public.household_members(user_id) where user_id is not null;
create index if not exists household_members_invited_email_idx on public.household_members(lower(invited_email)) where invited_email is not null;
create index if not exists household_activity_household_created_idx on public.household_activity(household_id, created_at desc);
create index if not exists shared_market_household_created_idx on public.shared_market_items(household_id, created_at);
create index if not exists shared_wishes_household_created_idx on public.shared_wishes(household_id, created_at);

create trigger households_set_updated_at
before update on public.households
for each row execute function public.set_updated_at();

create trigger household_members_set_updated_at
before update on public.household_members
for each row execute function public.set_updated_at();

create trigger market_items_set_updated_at
before update on public.shared_market_items
for each row execute function public.set_updated_at();

create trigger wishes_set_updated_at
before update on public.shared_wishes
for each row execute function public.set_updated_at();

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
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.household_members
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
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.households
    where id = target_household
      and owner_id = auth.uid()
  );
$$;

create or replace function public.can_view_household_module(target_household uuid, target_module text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_household_owner(target_household)
    or exists (
      select 1
      from public.household_members member
      join public.module_permissions permission
        on permission.member_id = member.id
       and permission.household_id = member.household_id
      where member.household_id = target_household
        and member.user_id = auth.uid()
        and member.status = 'active'
        and permission.module = target_module
        and permission.can_view = true
    );
$$;

create or replace function public.can_edit_household_module(target_household uuid, target_module text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_household_owner(target_household)
    or exists (
      select 1
      from public.household_members member
      join public.module_permissions permission
        on permission.member_id = member.id
       and permission.household_id = member.household_id
      where member.household_id = target_household
        and member.user_id = auth.uid()
        and member.status = 'active'
        and permission.module = target_module
        and permission.can_edit = true
    );
$$;

create or replace function public.claim_household_invites()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  claimed_count integer := 0;
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or current_email = '' then
    return 0;
  end if;

  update public.household_members invited
     set user_id = auth.uid(),
         status = 'active',
         joined_at = coalesce(joined_at, now()),
         updated_at = now()
   where invited.user_id is null
     and lower(invited.invited_email) = current_email
     and not exists (
       select 1
       from public.household_members existing
       where existing.household_id = invited.household_id
         and existing.user_id = auth.uid()
     );

  get diagnostics claimed_count = row_count;
  return claimed_count;
end;
$$;

revoke all on function public.is_household_member(uuid) from public;
revoke all on function public.is_household_owner(uuid) from public;
revoke all on function public.can_view_household_module(uuid, text) from public;
revoke all on function public.can_edit_household_module(uuid, text) from public;
revoke all on function public.claim_household_invites() from public;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_owner(uuid) to authenticated;
grant execute on function public.can_view_household_module(uuid, text) to authenticated;
grant execute on function public.can_edit_household_module(uuid, text) to authenticated;
grant execute on function public.claim_household_invites() to authenticated;

create policy "members read households"
on public.households for select
to authenticated
using (owner_id = auth.uid() or public.is_household_member(id));

create policy "owners create households"
on public.households for insert
to authenticated
with check (owner_id = auth.uid());

create policy "owners update households"
on public.households for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "owners delete households"
on public.households for delete
to authenticated
using (owner_id = auth.uid());

create policy "members read household members"
on public.household_members for select
to authenticated
using (public.is_household_member(household_id) or public.is_household_owner(household_id));

create policy "owners manage household members"
on public.household_members for all
to authenticated
using (public.is_household_owner(household_id))
with check (public.is_household_owner(household_id));

create policy "owners read all permissions and members read theirs"
on public.module_permissions for select
to authenticated
using (
  public.is_household_owner(household_id)
  or exists (
    select 1
    from public.household_members member
    where member.id = module_permissions.member_id
      and member.user_id = auth.uid()
      and member.status = 'active'
  )
);

create policy "owners manage permissions"
on public.module_permissions for all
to authenticated
using (public.is_household_owner(household_id))
with check (public.is_household_owner(household_id));

create policy "members read household activity"
on public.household_activity for select
to authenticated
using (public.is_household_member(household_id) or public.is_household_owner(household_id));

create policy "members create household activity"
on public.household_activity for insert
to authenticated
with check (
  (public.is_household_member(household_id) or public.is_household_owner(household_id))
  and (actor_id is null or actor_id = auth.uid())
);

create policy "allowed members read market"
on public.shared_market_items for select
to authenticated
using (public.can_view_household_module(household_id, 'market'));

create policy "editors manage market"
on public.shared_market_items for all
to authenticated
using (public.can_edit_household_module(household_id, 'market'))
with check (public.can_edit_household_module(household_id, 'market'));

create policy "allowed members read shared wishes"
on public.shared_wishes for select
to authenticated
using (is_shared = true and public.can_view_household_module(household_id, 'wishes'));

create policy "editors manage shared wishes"
on public.shared_wishes for all
to authenticated
using (public.can_edit_household_module(household_id, 'wishes'))
with check (public.can_edit_household_module(household_id, 'wishes'));

grant select, insert, update, delete on public.households to authenticated;
grant select, insert, update, delete on public.household_members to authenticated;
grant select, insert, update, delete on public.module_permissions to authenticated;
grant select, insert on public.household_activity to authenticated;
grant select, insert, update, delete on public.shared_market_items to authenticated;
grant select, insert, update, delete on public.shared_wishes to authenticated;
grant usage, select on sequence public.household_activity_id_seq to authenticated;

revoke all on public.households from anon;
revoke all on public.household_members from anon;
revoke all on public.module_permissions from anon;
revoke all on public.household_activity from anon;
revoke all on public.shared_market_items from anon;
revoke all on public.shared_wishes from anon;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'household_members') then
    alter publication supabase_realtime add table public.household_members;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'module_permissions') then
    alter publication supabase_realtime add table public.module_permissions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'household_activity') then
    alter publication supabase_realtime add table public.household_activity;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shared_market_items') then
    alter publication supabase_realtime add table public.shared_market_items;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shared_wishes') then
    alter publication supabase_realtime add table public.shared_wishes;
  end if;
end;
$$;
