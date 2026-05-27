/**
 * Comprehensive Miles Partain profile scraper.
 * Pulls every data point available from the volleyballlife.com API:
 *   - Full tournament history with finish positions
 *   - Partners in every event
 *   - All match results (upserted into existing matches table)
 *   - All opponent player stubs
 *
 * Prerequisites: run supabase/add_profile_tables.sql in the Supabase SQL editor first.
 * Usage: npm run scrape:miles
 */

import "./load-env.mjs";
import { createServiceClient } from "@/lib/supabase";
import type { Player, Match } from "@/types";

const SLUG = "1644";
const API_BASE = "https://api-v8.volleyballlife.com";
const DELAY = Number(process.env.SCRAPE_DELAY_MS ?? 1500);

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; VolleyChain-Bot/1.0)", Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

interface VBLPoints { total: number; system: string; short: string; }
interface VBLFinish { id: number; tdId: number; tournament: string; date: string; division: string; finish: number; sanctioningBodyId?: string; points?: VBLPoints[]; }
interface VBLProfile { id: number; firstName: string; lastName: string; tournaments: VBLFinish[]; }
interface VBLTeamPlayer { playerProfileId: number; name: string; }
interface VBLTeam { id: number; players: VBLTeamPlayer[]; }
interface VBLGame { home: number; away: number; }
interface VBLMatchTeam { teamId: number; }
interface VBLMatch { id: number; isWinners: boolean; round: number; games: VBLGame[]; homeTeam?: VBLMatchTeam; awayTeam?: VBLMatchTeam; }
interface VBLDivision {
  teams: VBLTeam[];
  days: Array<{ pools: Array<{ matches: VBLMatch[] }>; brackets: Array<{ matches: VBLMatch[] }>; }>;
}

interface TournamentResult {
  id: string; player_id: string; tournament_id: string; tournament_name: string;
  tournament_date: string | null; division: string; finish: number | null;
  partner_ids: string[]; partner_names: string[];
  points: number; sanctioning_body: string | null;
}
interface Partnership {
  id: string; player_a_id: string; player_b_id: string;
  player_a_name: string; player_b_name: string;
  tournament_name: string; tournament_date: string | null;
  division: string; finish: number | null;
}

// ---- main ----

const db = createServiceClient();

console.log(`\nFetching full profile for Miles Partain (slug ${SLUG})...`);
const profile = await apiGet<VBLProfile>(`/playerprofile/${SLUG}`);
const playerName = `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim();
console.log(`Name: ${playerName}`);
console.log(`Tournaments in profile: ${profile.tournaments?.length ?? 0}`);

await db.from("players").upsert(
  { id: SLUG, name: playerName, slug: SLUG, is_pro: true, created_at: new Date().toISOString() },
  { onConflict: "id" }
);

const tournamentResults: TournamentResult[] = [];
const partnerships: Partnership[] = [];
const allMatches: Match[] = [];
const opponentMap = new Map<string, Player>();
const seenMatchIds = new Set<string>();
const seenDivisions = new Set<number>();
const seenPartnerKeys = new Set<string>();

let divIdx = 0;
for (const finish of profile.tournaments ?? []) {
  if (!finish.tdId || seenDivisions.has(finish.tdId)) continue;
  seenDivisions.add(finish.tdId);
  divIdx++;

  await sleep(DELAY);

  let div: VBLDivision;
  try {
    div = await apiGet<VBLDivision>(`/division/${finish.tdId}/hydrate`);
  } catch {
    console.warn(`  [${divIdx}] Skipping division ${finish.tdId}: fetch failed`);
    continue;
  }

  const tournDate = finish.date?.split("T")[0] ?? null;
  const teamPlayers = new Map<number, VBLTeamPlayer[]>();
  for (const team of div.teams ?? []) teamPlayers.set(team.id, team.players ?? []);

  // Find Miles's team(s)
  const milesTeams = (div.teams ?? []).filter(t =>
    t.players?.some(p => String(p.playerProfileId) === SLUG)
  );
  const milesTeamIds = new Set(milesTeams.map(t => t.id));

  // Collect all partners across every team Miles was on in this division
  const allPartners = milesTeams
    .flatMap(t => t.players.filter(p => String(p.playerProfileId) !== SLUG));
  const uniquePartners = [...new Map(allPartners.map(p => [p.playerProfileId, p])).values()];

  // One tournament result per division (merged partner list)
  const maxPoints = Math.max(0, ...(finish.points ?? []).map(p => p.total));
  tournamentResults.push({
    id: `${SLUG}-${finish.tdId}`,
    player_id: SLUG,
    tournament_id: String(finish.id),
    tournament_name: finish.tournament,
    tournament_date: tournDate,
    division: finish.division,
    finish: finish.finish ?? null,
    partner_ids: uniquePartners.map(p => String(p.playerProfileId)),
    partner_names: uniquePartners.map(p => p.name),
    points: maxPoints,
    sanctioning_body: finish.sanctioningBodyId ?? null,
  });

  // Partnerships
  for (const team of milesTeams) {
    const partners = team.players.filter(p => String(p.playerProfileId) !== SLUG);

    for (const p of partners) {
      const pid = String(p.playerProfileId);
      if (!opponentMap.has(pid))
        opponentMap.set(pid, { id: pid, name: p.name, slug: pid, is_pro: false, created_at: new Date().toISOString() });

      const [pA, pB] = [SLUG, pid].sort();
      const partKey = `${pA}-${pB}-${finish.tdId}`;
      if (!seenPartnerKeys.has(partKey)) {
        seenPartnerKeys.add(partKey);
        partnerships.push({
          id: partKey,
          player_a_id: pA,
          player_b_id: pB,
          player_a_name: pA === SLUG ? playerName : p.name,
          player_b_name: pB === SLUG ? playerName : p.name,
          tournament_name: finish.tournament,
          tournament_date: tournDate,
          division: finish.division,
          finish: finish.finish ?? null,
        });
      }
    }
  }

  // Match records (all matches in division, not just Miles's)
  const rawMatches: VBLMatch[] = [];
  for (const day of div.days ?? []) {
    for (const pool of day.pools ?? []) rawMatches.push(...(pool.matches ?? []));
    for (const bracket of day.brackets ?? []) rawMatches.push(...(bracket.matches ?? []));
  }

  let matchCount = 0;
  for (const m of rawMatches) {
    if (!m.homeTeam || !m.awayTeam || !m.games?.length) continue;

    let homeGames = 0, awayGames = 0;
    for (const g of m.games) {
      if (g.home > g.away) homeGames++;
      else if (g.away > g.home) awayGames++;
    }
    if (homeGames === 0 && awayGames === 0) continue;

    const homeWon = homeGames >= awayGames;
    const winnerTeamId = homeWon ? m.homeTeam.teamId : m.awayTeam.teamId;
    const loserTeamId  = homeWon ? m.awayTeam.teamId : m.homeTeam.teamId;
    const winnerPlayers = teamPlayers.get(winnerTeamId) ?? [];
    const loserPlayers  = teamPlayers.get(loserTeamId)  ?? [];
    if (!winnerPlayers.length || !loserPlayers.length) continue;

    // Only store matches involving Miles's team
    const involvesMiles = milesTeamIds.has(winnerTeamId) || milesTeamIds.has(loserTeamId);
    if (!involvesMiles) continue;

    const score = m.games.map(g => homeWon ? `${g.home}-${g.away}` : `${g.away}-${g.home}`).join(", ");
    const roundName = m.isWinners ? `Winners R${m.round + 1}` : `Losers R${m.round + 1}`;

    for (const wp of winnerPlayers) {
      for (const lp of loserPlayers) {
        const matchId = `${finish.tdId}-${m.id}-${wp.playerProfileId}-${lp.playerProfileId}`;
        if (seenMatchIds.has(matchId)) continue;
        seenMatchIds.add(matchId);
        matchCount++;

        for (const rp of [wp, lp]) {
          const rid = String(rp.playerProfileId);
          if (!opponentMap.has(rid))
            opponentMap.set(rid, { id: rid, name: rp.name, slug: rid, is_pro: false, created_at: new Date().toISOString() });
        }

        allMatches.push({
          id: matchId,
          tournament_id: String(finish.id),
          tournament_name: finish.tournament,
          tournament_date: tournDate ?? "",
          round: roundName,
          winner_id: String(wp.playerProfileId),
          loser_id:  String(lp.playerProfileId),
          winner_name: wp.name,
          loser_name:  lp.name,
          score,
          created_at: new Date().toISOString(),
        });
      }
    }
  }

  const partnerNames = milesTeams.flatMap(t =>
    t.players.filter(p => String(p.playerProfileId) !== SLUG).map(p => p.name)
  );
  console.log(
    `  [${divIdx}] ${finish.tournament} (${finish.division}) | ` +
    `Finish: ${finish.finish ?? "?"} | ` +
    `Partner(s): ${partnerNames.join(" + ") || "solo/unknown"} | ` +
    `Matches: ${matchCount}`
  );
}

// ---- Save to Supabase ----

console.log(`\nSaving to Supabase...`);

// Player stubs
const stubs = Array.from(opponentMap.values());
for (let i = 0; i < stubs.length; i += 500) {
  await db.from("players").upsert(stubs.slice(i, i + 500), { onConflict: "id", ignoreDuplicates: true });
}
console.log(`  Players: ${stubs.length}`);

// Matches
for (let i = 0; i < allMatches.length; i += 500) {
  const { error } = await db.from("matches").upsert(allMatches.slice(i, i + 500), { onConflict: "id" });
  if (error) console.error(`  Match batch error: ${error.message}`);
}
console.log(`  Matches: ${allMatches.length}`);

// Tournament results
if (tournamentResults.length > 0) {
  const { error } = await db.from("tournament_results").upsert(tournamentResults, { onConflict: "id" });
  if (error) console.error(`  Tournament results error: ${error.message}`);
  else console.log(`  Tournament results: ${tournamentResults.length}`);
}

// Partnerships
if (partnerships.length > 0) {
  for (let i = 0; i < partnerships.length; i += 500) {
    const { error } = await db.from("partnerships").upsert(partnerships.slice(i, i + 500), { onConflict: "id" });
    if (error) console.error(`  Partnerships error: ${error.message}`);
  }
  console.log(`  Partnerships: ${partnerships.length}`);
}

console.log(`\n=== Summary ===`);
console.log(`  Tournaments scraped:   ${seenDivisions.size}`);
console.log(`  Match records saved:   ${allMatches.length}`);
console.log(`  Unique players found:  ${opponentMap.size}`);
console.log(`  Partnerships recorded: ${partnerships.length}`);
