-- VolleyChain Supabase Schema
-- Run this in the Supabase SQL editor to create the required tables.

-- Players table
create table if not exists public.players (
  id          text primary key,
  name        text not null,
  slug        text not null,
  avp_rank    integer,
  is_pro      boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists players_name_idx on public.players using gin(to_tsvector('english', name));
create index if not exists players_slug_idx on public.players (slug);

-- Matches table
create table if not exists public.matches (
  id                text primary key,
  tournament_id     text not null,
  tournament_name   text not null,
  tournament_date   date,
  round             text,
  winner_id         text not null references public.players(id),
  loser_id          text not null references public.players(id),
  winner_name       text not null,
  loser_name        text not null,
  score             text,
  created_at        timestamptz not null default now()
);

create index if not exists matches_winner_idx on public.matches (winner_id);
create index if not exists matches_loser_idx  on public.matches (loser_id);
create index if not exists matches_date_idx   on public.matches (tournament_date desc);

-- Enable Row Level Security (read-only public access)
alter table public.players enable row level security;
alter table public.matches  enable row level security;

create policy "Public read players" on public.players
  for select using (true);

create policy "Public read matches" on public.matches
  for select using (true);

-- Service role can insert/update (used by scraper)
create policy "Service insert players" on public.players
  for all using (auth.role() = 'service_role');

create policy "Service insert matches" on public.matches
  for all using (auth.role() = 'service_role');
