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
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and lower(email) in ('tomderoos@proton.me', 'rinske.jansen@proton.me')
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

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  platform text not null default 'marktplaats',
  url text not null default '',
  asking_price numeric(12, 2) not null default 0,
  sold boolean not null default false,
  sold_price numeric(12, 2),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sale_items enable row level security;

drop policy if exists "allowed read sale_items"   on public.sale_items;
drop policy if exists "allowed write sale_items"  on public.sale_items;
drop policy if exists "allowed update sale_items" on public.sale_items;
drop policy if exists "allowed delete sale_items" on public.sale_items;
create policy "allowed read sale_items"   on public.sale_items for select using (public.is_allowed());
create policy "allowed write sale_items"  on public.sale_items for insert with check (public.is_allowed());
create policy "allowed update sale_items" on public.sale_items for update using (public.is_allowed());
create policy "allowed delete sale_items" on public.sale_items for delete using (public.is_allowed());

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  category text not null default 'overig',
  amount numeric(12, 2) not null default 0,
  planned boolean not null default false,
  date date not null default current_date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expenses enable row level security;

drop policy if exists "allowed read expenses"   on public.expenses;
drop policy if exists "allowed write expenses"  on public.expenses;
drop policy if exists "allowed update expenses" on public.expenses;
drop policy if exists "allowed delete expenses" on public.expenses;
create policy "allowed read expenses"   on public.expenses for select using (public.is_allowed());
create policy "allowed write expenses"  on public.expenses for insert with check (public.is_allowed());
create policy "allowed update expenses" on public.expenses for update using (public.is_allowed());
create policy "allowed delete expenses" on public.expenses for delete using (public.is_allowed());

-- Realtime: laat wijzigingen naar alle clients streamen (idempotent).
do $$ begin
  alter publication supabase_realtime add table public.todos;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.events;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.settings;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.expenses;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.sale_items;
exception when duplicate_object then null; end $$;

-- updated_at auto-onderhoud.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists todos_touch on public.todos;
drop trigger if exists events_touch on public.events;
drop trigger if exists expenses_touch on public.expenses;
drop trigger if exists sale_items_touch on public.sale_items;
create trigger todos_touch      before update on public.todos      for each row execute function public.touch_updated_at();
create trigger events_touch     before update on public.events     for each row execute function public.touch_updated_at();
create trigger expenses_touch   before update on public.expenses   for each row execute function public.touch_updated_at();
create trigger sale_items_touch before update on public.sale_items for each row execute function public.touch_updated_at();
