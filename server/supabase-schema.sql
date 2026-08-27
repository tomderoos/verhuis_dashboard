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

-- Row Level Security: alleen adressen op de whitelist kunnen lezen/schrijven.
alter table public.todos    enable row level security;
alter table public.events   enable row level security;
alter table public.settings enable row level security;

create or replace function public.is_allowed()
returns boolean language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') in (
    'tomderoos@proton.me',
    'rinske.jansen@proton.me'
  );
$$;

drop policy if exists "allowed read todos"   on public.todos;
drop policy if exists "allowed write todos"  on public.todos;
drop policy if exists "allowed update todos" on public.todos;
drop policy if exists "allowed delete todos" on public.todos;
create policy "allowed read todos"   on public.todos for select using (public.is_allowed());
create policy "allowed write todos"  on public.todos for insert with check (public.is_allowed());
create policy "allowed update todos" on public.todos for update using (public.is_allowed());
create policy "allowed delete todos" on public.todos for delete using (public.is_allowed());

drop policy if exists "allowed read events"   on public.events;
drop policy if exists "allowed write events"  on public.events;
drop policy if exists "allowed update events" on public.events;
drop policy if exists "allowed delete events" on public.events;
create policy "allowed read events"   on public.events for select using (public.is_allowed());
create policy "allowed write events"  on public.events for insert with check (public.is_allowed());
create policy "allowed update events" on public.events for update using (public.is_allowed());
create policy "allowed delete events" on public.events for delete using (public.is_allowed());

drop policy if exists "allowed read settings"  on public.settings;
drop policy if exists "allowed write settings" on public.settings;
create policy "allowed read settings"  on public.settings for select using (public.is_allowed());
create policy "allowed write settings" on public.settings for insert with check (public.is_allowed());
create policy "allowed update settings" on public.settings for update using (public.is_allowed());

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
