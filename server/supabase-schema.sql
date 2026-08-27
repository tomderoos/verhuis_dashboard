-- Verhuis-dashboard schema
-- Draai deze SQL in Supabase → SQL Editor → New query.

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  done boolean not null default false,
  comment text default '' not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  title text not null,
  type text not null default 'klus',
  notes text default '' not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settings (
  key text primary key,
  value jsonb not null
);

insert into public.settings (key, value)
values ('keyDate', to_jsonb('2026-12-18T10:00:00'::text))
on conflict (key) do nothing;

-- Row Level Security: elk ingelogd account mag alles lezen en schrijven.
alter table public.todos    enable row level security;
alter table public.events   enable row level security;
alter table public.settings enable row level security;

drop policy if exists "auth read todos"   on public.todos;
drop policy if exists "auth write todos"  on public.todos;
drop policy if exists "auth update todos" on public.todos;
drop policy if exists "auth delete todos" on public.todos;
create policy "auth read todos"   on public.todos for select using (auth.uid() is not null);
create policy "auth write todos"  on public.todos for insert with check (auth.uid() is not null);
create policy "auth update todos" on public.todos for update using (auth.uid() is not null);
create policy "auth delete todos" on public.todos for delete using (auth.uid() is not null);

drop policy if exists "auth read events"   on public.events;
drop policy if exists "auth write events"  on public.events;
drop policy if exists "auth update events" on public.events;
drop policy if exists "auth delete events" on public.events;
create policy "auth read events"   on public.events for select using (auth.uid() is not null);
create policy "auth write events"  on public.events for insert with check (auth.uid() is not null);
create policy "auth update events" on public.events for update using (auth.uid() is not null);
create policy "auth delete events" on public.events for delete using (auth.uid() is not null);

drop policy if exists "auth read settings"  on public.settings;
drop policy if exists "auth write settings" on public.settings;
create policy "auth read settings"  on public.settings for select using (auth.uid() is not null);
create policy "auth write settings" on public.settings for insert with check (auth.uid() is not null);
create policy "auth update settings" on public.settings for update using (auth.uid() is not null);

-- Realtime: laat wijzigingen naar alle clients streamen.
alter publication supabase_realtime add table public.todos;
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.settings;

-- updated_at auto-onderhoud.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists todos_touch on public.todos;
drop trigger if exists events_touch on public.events;
create trigger todos_touch  before update on public.todos  for each row execute function public.touch_updated_at();
create trigger events_touch before update on public.events for each row execute function public.touch_updated_at();
