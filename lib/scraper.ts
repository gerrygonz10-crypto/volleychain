import type { Player, Match } from "@/types";

const API_BASE = "https://api-v8.volleyballlife.com";
const DELAY = Number(process.env.SCRAPE_DELAY_MS ?? 1500);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; VolleyChain-Bot/1.0)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

// ---- API response shapes ----

interface VBLFinish {
  id: number;    // tournament ID
  tdId: number;  // division ID — key for hydrate calls (only in main profile endpoint)
  tournament: string;
  date: string;
  division: string;
  finish: number;
}

// Main profile endpoint — has tdId on each tournament entry
interface VBLProfileResponse {
  id: number;
  firstName: string;
  lastName: string;
  tournaments: VBLFinish[];
}

interface VBLTeamPlayer {
  playerProfileId: number;
  name: string;
}

interface VBLTeam {
  id: number;
  players: VBLTeamPlayer[];
}

interface VBLGame {
  home: number;
  away: number;
}

interface VBLMatchTeam {
  teamId: number;
}

interface VBLMatch {
  id: number;
  isWinners: boolean;
  round: number;
  games: VBLGame[];
  homeTeam?: VBLMatchTeam;
  awayTeam?: VBLMatchTeam;
}

interface VBLDivision {
  teams: VBLTeam[];
  days: Array<{
    pools: Array<{ matches: VBLMatch[] }>;
    brackets: Array<{ matches: VBLMatch[] }>;
  }>;
}

interface VBLSearchResult {
  id: number;
  firstName: string;
  lastName: string;
}

// ---- public API ----

export async function searchPlayers(query: string): Promise<Player[]> {
  const results = await apiGet<VBLSearchResult[]>(
    `/playerprofile/search/${encodeURIComponent(query)}`
  );
  return (results || []).map((p) => ({
    id: String(p.id),
    name: `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim(),
    slug: String(p.id),
    is_pro: false,
    created_at: new Date().toISOString(),
  }));
}

export async function scrapePlayerMatches(
  slug: string
): Promise<{ player: Player; matches: Match[] }> {
  // Main profile endpoint has tdId (division ID) on every tournament entry
  const profile = await apiGet<VBLProfileResponse>(`/playerprofile/${slug}`);

  const player: Player = {
    id: String(profile.id),
    name: `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim(),
    slug: String(profile.id),
    is_pro: false,
    created_at: new Date().toISOString(),
  };

  const matches: Match[] = [];
  const seenMatchIds = new Set<string>();
  const seenDivisions = new Set<number>();

  for (const finish of profile.tournaments ?? []) {
    if (!finish.tdId || seenDivisions.has(finish.tdId)) continue;
    seenDivisions.add(finish.tdId);

    await sleep(DELAY);

    let divData: VBLDivision;
    try {
      divData = await apiGet<VBLDivision>(`/division/${finish.tdId}/hydrate`);
    } catch {
      console.warn(`  Skipping division ${finish.tdId}: fetch failed`);
      continue;
    }

    // teamId → individual players
    const teamPlayers = new Map<number, VBLTeamPlayer[]>();
    for (const team of divData.teams ?? []) {
      teamPlayers.set(team.id, team.players ?? []);
    }

    // collect matches from both pool play and bracket play
    const rawMatches: VBLMatch[] = [];
    for (const day of divData.days ?? []) {
      for (const pool of day.pools ?? []) rawMatches.push(...(pool.matches ?? []));
      for (const bracket of day.brackets ?? []) rawMatches.push(...(bracket.matches ?? []));
    }

    for (const m of rawMatches) {
      if (!m.homeTeam || !m.awayTeam || !m.games?.length) continue;

      // Determine winner by counting game wins
      let homeGames = 0;
      let awayGames = 0;
      for (const g of m.games) {
        if (g.home > g.away) homeGames++;
        else if (g.away > g.home) awayGames++;
      }
      if (homeGames === 0 && awayGames === 0) continue; // no scores recorded

      const homeWon = homeGames >= awayGames;
      const winnerTeamId = homeWon ? m.homeTeam.teamId : m.awayTeam.teamId;
      const loserTeamId = homeWon ? m.awayTeam.teamId : m.homeTeam.teamId;

      const winnerPlayers = teamPlayers.get(winnerTeamId) ?? [];
      const loserPlayers = teamPlayers.get(loserTeamId) ?? [];
      if (!winnerPlayers.length || !loserPlayers.length) continue;

      const score = m.games
        .map((g) => (homeWon ? `${g.home}-${g.away}` : `${g.away}-${g.home}`))
        .join(", ");

      const roundName = m.isWinners
        ? `Winners R${m.round + 1}`
        : `Losers R${m.round + 1}`;

      // one record per (winner player, loser player) pair — enables individual H2H + six degrees
      for (const wp of winnerPlayers) {
        for (const lp of loserPlayers) {
          const matchId = `${finish.tdId}-${m.id}-${wp.playerProfileId}-${lp.playerProfileId}`;
          if (seenMatchIds.has(matchId)) continue;
          seenMatchIds.add(matchId);

          matches.push({
            id: matchId,
            tournament_id: String(finish.id),
            tournament_name: finish.tournament,
            tournament_date: finish.date.split("T")[0],
            round: roundName,
            winner_id: String(wp.playerProfileId),
            loser_id: String(lp.playerProfileId),
            winner_name: wp.name,
            loser_name: lp.name,
            score,
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    console.log(
      `  Division ${finish.tdId} (${finish.tournament} – ${finish.division}): ${rawMatches.length} matches processed`
    );
  }

  return { player, matches };
}

export async function scrapeMultiplePlayers(
  slugs: string[]
): Promise<{ players: Player[]; matches: Match[] }> {
  const allPlayers: Player[] = [];
  const allMatches: Match[] = [];
  const seen = new Set<string>();

  for (const slug of slugs) {
    try {
      const { player, matches } = await scrapePlayerMatches(slug);
      allPlayers.push(player);
      for (const m of matches) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          allMatches.push(m);
        }
      }
      console.log(`Scraped ${slug}: ${matches.length} match records`);
    } catch (err) {
      console.error(`Failed to scrape ${slug}:`, err);
    }
    await sleep(DELAY);
  }

  return { players: allPlayers, matches: allMatches };
}
