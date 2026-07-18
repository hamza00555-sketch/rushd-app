create table if not exists public.promotion_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  current_salary numeric(12,2) not null check (current_salary > 0),
  new_salary numeric(12,2) not null check (new_salary >= current_salary),
  profile_id text not null check (profile_id in ('balanced', 'security', 'lifestyle')),
  increase_amount numeric(12,2) not null check (increase_amount >= 0),
  increase_rate numeric(7,2) not null check (increase_rate >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists promotion_scenarios_user_created_idx
  on public.promotion_scenarios(user_id, created_at desc);

create trigger promotion_scenarios_set_updated_at
before update on public.promotion_scenarios
for each row execute function public.set_updated_at();

alter table public.promotion_scenarios enable row level security;

create policy "users read own promotion scenarios"
on public.promotion_scenarios for select
to authenticated
using (user_id = auth.uid());

create policy "users create own promotion scenarios"
on public.promotion_scenarios for insert
to authenticated
with check (user_id = auth.uid());

create policy "users update own promotion scenarios"
on public.promotion_scenarios for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users delete own promotion scenarios"
on public.promotion_scenarios for delete
to authenticated
using (user_id = auth.uid());

grant select, insert, update, delete on public.promotion_scenarios to authenticated;
revoke all on public.promotion_scenarios from anon;
