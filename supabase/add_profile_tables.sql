-- Run this in the Supabase SQL editor before running scripts/scrape-miles-profile.mts

-- Tournament results: one row per player per division entry (finish + partners)
create table if not exists public.tournament_results (
  id               text primary key,  -- "{player_id}-{tdId}"
  player_id        text not null references public.players(id),
  tournament_id    text not null,
  tournament_name  text not null,
  tournament_date  date,
  division         text,
  finish           integer,
  partner_ids      text[],
  partner_names    text[],
  created_at       timestamptz not null default now()
);

create index if not exists tr_player_idx on public.tournament_results (player_id);
create index if not exists tr_date_idx   on public.tournament_results (tournament_date desc);
create index if not exists tr_finish_idx on public.tournament_results (finish);

-- Partnerships: one row per (player, partner, division) — directional, deduped by canonical ordering
create table if not exists public.partnerships (
  id               text primary key,  -- "{min(p1,p2)}-{max(p1,p2)}-{tdId}"
  player_a_id      text not null references public.players(id),
  player_b_id      text not null references public.players(id),
  player_a_name    text not null,
  player_b_name    text not null,
  tournament_name  text not null,
  tournament_date  date,
  division         text,
  finish           integer,
  created_at       timestamptz not null default now()
);

create index if not exists part_a_idx on public.partnerships (player_a_id);
create index if not exists part_b_idx on public.partnerships (player_b_id);

-- RLS
alter table public.tournament_results enable row level security;
alter table public.partnerships        enable row level security;

create policy "Public read tournament_results" on public.tournament_results for select using (true);
create policy "Public read partnerships"        on public.partnerships        for select using (true);
create policy "Service insert tournament_results" on public.tournament_results for all using (auth.role() = 'service_role');
create policy "Service insert partnerships"        on public.partnerships        for all using (auth.role() = 'service_role');
