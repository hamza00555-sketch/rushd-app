create table if not exists public.investment_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  account_type text not null check (account_type in ('investment', 'cash', 'child')),
  balance numeric(14,2) not null default 0 check (balance >= 0),
  monthly_contribution numeric(12,2) not null default 0 check (monthly_contribution >= 0),
  annual_return numeric(6,2) not null default 0 check (annual_return between 0 and 100),
  icon text not null default '↗',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.financial_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  target numeric(14,2) not null check (target > 0),
  saved numeric(14,2) not null default 0 check (saved >= 0),
  monthly_contribution numeric(12,2) not null default 0 check (monthly_contribution >= 0),
  priority text not null check (priority in ('high', 'medium', 'low')) default 'medium',
  linked_wish text,
  icon text not null default '◎',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists investment_accounts_user_idx on public.investment_accounts(user_id, created_at);
create index if not exists financial_goals_user_idx on public.financial_goals(user_id, created_at);

create trigger investment_accounts_set_updated_at before update on public.investment_accounts for each row execute function public.set_updated_at();
create trigger financial_goals_set_updated_at before update on public.financial_goals for each row execute function public.set_updated_at();

alter table public.investment_accounts enable row level security;
alter table public.financial_goals enable row level security;

create policy "users manage own investment accounts" on public.investment_accounts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users manage own financial goals" on public.financial_goals for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.investment_accounts to authenticated;
grant select, insert, update, delete on public.financial_goals to authenticated;
revoke all on public.investment_accounts from anon;
revoke all on public.financial_goals from anon;
