-- Run once in the Supabase SQL editor. No service-role key belongs in the app.
create table if not exists public.expense_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 state jsonb not null check (jsonb_typeof(state) = 'object' and state ->> 'version' = '1'),
 revision bigint not null default 1 check (revision > 0),
 updated_at timestamptz not null default now()
);
alter table public.expense_accounts enable row level security;
revoke all on public.expense_accounts from anon, authenticated;
grant select on public.expense_accounts to authenticated;
drop policy if exists "Read own expenses" on public.expense_accounts;
create policy "Read own expenses" on public.expense_accounts for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.save_expenses(document jsonb, expected_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid(); next_revision bigint;
begin
 if owner_id is null then raise exception 'Sign in to save expenses' using errcode = '42501'; end if;
 if jsonb_typeof(document) is distinct from 'object' or document ->> 'version' is distinct from '1' or octet_length(document::text) > 20971520 then
  raise exception 'Invalid expense data' using errcode = '22023';
 end if;
 if expected_revision = 0 then
  insert into public.expense_accounts (user_id,state,revision) values (owner_id,document,1)
  on conflict (user_id) do nothing returning revision into next_revision;
 else
  update public.expense_accounts set state=document,revision=revision+1,updated_at=now()
  where user_id=owner_id and revision=expected_revision returning revision into next_revision;
 end if;
 if next_revision is null then raise exception 'Expenses changed on another device' using errcode = '40001'; end if;
 return jsonb_build_object('state',document,'revision',next_revision);
end;
$$;
revoke all on function public.save_expenses(jsonb,bigint) from public, anon;
grant execute on function public.save_expenses(jsonb,bigint) to authenticated;
