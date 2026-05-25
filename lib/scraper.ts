/**
 * volleyballlife.com scraper
 *
 * Pulls tournament match results from public player profile pages.
 * Rate-limited to be respectful of the server.
 */

import axios from "axios";
import * as cheerio from "cheerio";
import type { Player, Match } from "@/types";

const BASE_URL = "https://www.volleyballlife.com";
const DELAY = Number(process.env.SCRAPE_DELAY_MS ?? 1500);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<string> {
  const res = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; VolleyChain-Bot/1.0; +https://github.com/volleychain)",
      Accept: "text/html,application/xhtml+xml",
    },
    timeout: 15_000,
  });
  return res.data as string;
}

/** Search for players by name on volleyballlife.com */
export async function searchPlayers(query: string): Promise<Player[]> {
  const url = `${BASE_URL}/search?q=${encodeURIComponent(query)}&type=player`;
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  const players: Player[] = [];

  // Selector based on volleyballlife.com search results markup
  $(".player-result, .search-result-player, [data-player-id]").each(
    (_, el) => {
      const $el = $(el);
      const name =
        $el.find(".player-name, .name").text().trim() ||
        $el.attr("data-player-name") ||
        "";
      const href =
        $el.find("a").first().attr("href") || $el.attr("data-href") || "";
      const slug = href.split("/").filter(Boolean).pop() || "";
      const id = $el.attr("data-player-id") || slug;

      if (name && slug) {
        players.push({
          id,
          name,
          slug,
          is_pro: false,
          created_at: new Date().toISOString(),
        });
      }
    }
  );

  return players;
}

/** Scrape all matches for a player from their profile page */
export async function scrapePlayerMatches(
  playerSlug: string
): Promise<{ player: Player; matches: Match[] }> {
  const url = `${BASE_URL}/players/${playerSlug}/results`;
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  // Extract player info
  const playerName =
    $("h1.player-name, .profile-name, [itemprop=name]").first().text().trim() ||
    playerSlug;
  const playerId =
    $("[data-player-id]").first().attr("data-player-id") || playerSlug;

  const player: Player = {
    id: playerId,
    name: playerName,
    slug: playerSlug,
    is_pro: false,
    created_at: new Date().toISOString(),
  };

  const matches: Match[] = [];

  // Parse match rows — volleyballlife uses a table or card layout per tournament
  $(".tournament-results, .results-table, .match-row").each((_, tournEl) => {
    const $tourn = $(tournEl);
    const tournamentName =
      $tourn.find(".tournament-name, .event-name").text().trim();
    const tournamentDate =
      $tourn.find(".tournament-date, .event-date").text().trim();
    const tournamentId = slugify(`${tournamentName}-${tournamentDate}`);

    $tourn.find(".match, tr.match-row, [data-match]").each((_, matchEl) => {
      const $m = $(matchEl);
      const opponentName = $m
        .find(".opponent-name, .opponent, td.opponent")
        .text()
        .trim();
      const opponentSlug = (
        $m.find("a[href*='/players/']").attr("href") || ""
      )
        .split("/")
        .filter(Boolean)
        .pop() || slugify(opponentName);
      const score = $m.find(".score, .match-score, td.score").text().trim();
      const resultText = $m
        .find(".result, .win-loss, td.result")
        .text()
        .trim()
        .toLowerCase();
      const round = $m.find(".round, td.round").text().trim();

      if (!opponentName) return;

      const isWin = resultText.startsWith("w") || resultText === "win";
      const matchId = slugify(
        `${tournamentId}-${playerSlug}-${opponentSlug}-${round}`
      );

      matches.push({
        id: matchId,
        tournament_id: tournamentId,
        tournament_name: tournamentName,
        tournament_date: normalizeDateString(tournamentDate),
        round,
        winner_id: isWin ? playerId : opponentSlug,
        loser_id: isWin ? opponentSlug : playerId,
        winner_name: isWin ? playerName : opponentName,
        loser_name: isWin ? opponentName : playerName,
        score,
        created_at: new Date().toISOString(),
      });
    });
  });

  return { player, matches };
}

/** Scrape multiple players with rate limiting */
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

      console.log(`Scraped ${slug}: ${matches.length} matches`);
    } catch (err) {
      console.error(`Failed to scrape ${slug}:`, err);
    }

    await sleep(DELAY);
  }

  return { players: allPlayers, matches: allMatches };
}

// ---- helpers ----

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeDateString(raw: string): string {
  const d = new Date(raw);
  return isNaN(d.getTime()) ? raw : d.toISOString().split("T")[0];
}
