create table if not exists public.message_collections (
    name text primary key,
    payload jsonb not null default '[]'::jsonb,
    updated_at timestamptz not null default now()
);

create or replace function public.touch_message_collections_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists message_collections_touch_updated_at on public.message_collections;

create trigger message_collections_touch_updated_at
before update on public.message_collections
for each row
execute function public.touch_message_collections_updated_at();

alter table public.message_collections enable row level security;

drop policy if exists "public read message collections" on public.message_collections;
drop policy if exists "public write message collections" on public.message_collections;
drop policy if exists "public update message collections" on public.message_collections;

create policy "public read message collections"
on public.message_collections
for select
using (true);

create policy "public write message collections"
on public.message_collections
for insert
with check (true);

create policy "public update message collections"
on public.message_collections
for update
using (true)
with check (true);