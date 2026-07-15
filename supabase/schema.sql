create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

drop policy if exists "Users manage their own state" on public.user_state;

create policy "Users manage their own state"
on public.user_state
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

do $$
begin
  alter publication supabase_realtime add table public.user_state;
exception
  when duplicate_object then null;
end $$;
