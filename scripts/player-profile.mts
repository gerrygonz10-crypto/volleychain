/**
 * Full chain + stat profile for a list of players.
 * Usage: npm run scrape -- (or just run directly with tsx)
 */
import "./load-env.mjs";
import { createServiceClient } from "@/lib/supabase";
import { buildGraph, findShortestChain } from "@/lib/graph";
import type { Player, Match } from "@/types";

const MILES_ID = "1644";
const TARGET_NAMES = ["David Acevedo", "Engjell Allajbegu"];

const db = createServiceClient();

// ---- Look up players ----
console.log("Looking up players...");
const foundPlayers: { name: string; id: string }[] = [];
for (const name of TARGET_NAMES) {
  const parts = name.split(" ");
  const { data } = await db.from("players").select("id, name")
    .ilike("name", `%${parts[0]}%`)
    .ilike("name", `%${parts[parts.length - 1]}%`)
    .limit(5);
  if (data && data.length > 0) {
    console.log(`  ${name}: ${JSON.stringify(data)}`);
    foundPlayers.push({ name, id: data[0].id });
  } else {
    console.log(`  ${name}: NOT FOUND`);
  }
}

if (foundPlayers.length === 0) { console.log("No players found."); process.exit(0); }

// ---- Load full match graph ----
console.log("\nLoading matches...");
const allMatches: Match[] = [];
let offset = 0;
while (true) {
  const { data, error } = await db.from("matches").select("*").order("id").range(offset, offset + 999);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) break;
  allMatches.push(...(data as Match[]));
  if (data.length < 1000) break;
  offset += 1000;
  if (offset % 100000 === 0) process.stdout.write(`  ...${offset.toLocaleString()}\n`);
}
console.log(`Loaded ${allMatches.length.toLocaleString()} matches\n`);

const playerMap = new Map<string, Player>();
for (const m of allMatches) {
  if (!playerMap.has(m.winner_id)) playerMap.set(m.winner_id, { id: m.winner_id, name: m.winner_name, slug: m.winner_id, is_pro: false, created_at: "" });
  if (!playerMap.has(m.loser_id))  playerMap.set(m.loser_id,  { id: m.loser_id,  name: m.loser_name,  slug: m.loser_id,  is_pro: false, created_at: "" });
}
const graph = buildGraph([...playerMap.values()], allMatches);

// ---- Per-player analysis ----
for (const { name, id } of foundPlayers) {
  const wins   = allMatches.filter(m => m.winner_id === id);
  const losses = allMatches.filter(m => m.loser_id  === id);
  const all    = [...wins, ...losses];

  console.log("=".repeat(60));
  console.log(`${name.toUpperCase()} (ID ${id})`);
  console.log("=".repeat(60));

  // ---- Chain ----
  const chain = findShortestChain(graph, id, new Set([MILES_ID]));
  if (!chain) {
    console.log("Chain to Miles Partain: NOT FOUND");
  } else {
    console.log(`Chain to Miles Partain: ${chain.degrees} degree(s)`);
    for (const link of chain.chain) {
      console.log(`  ${link.winner.name} beat ${link.loser.name}  [${link.match.tournament_name} | ${link.match.tournament_date} | ${link.match.round} | ${link.match.score}]`);
    }
  }

  // ---- Basic record ----
  const total = wins.length + losses.length;
  const winPct = total > 0 ? ((wins.length / total) * 100).toFixed(1) : "0.0";
  console.log(`\nRecord: ${wins.length}W – ${losses.length}L (${winPct}% win rate)`);

  // ---- Date range ----
  const dates = all.map(m => m.tournament_date).filter(Boolean).sort();
  if (dates.length > 0) {
    console.log(`Active: ${dates[0]} → ${dates[dates.length - 1]}`);
  }

  // ---- Most common tournament ----
  const tournCount = new Map<string, number>();
  for (const m of all) {
    tournCount.set(m.tournament_name, (tournCount.get(m.tournament_name) ?? 0) + 1);
  }
  const topTourns = [...tournCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  console.log(`\nMost common tournaments:`);
  for (const [t, c] of topTourns) console.log(`  ${c} records — ${t}`);

  // ---- Most frequent opponents ----
  const oppCount = new Map<string, { name: string; wins: number; losses: number }>();
  for (const m of wins) {
    const e = oppCount.get(m.loser_id) ?? { name: m.loser_name, wins: 0, losses: 0 };
    e.wins++;
    oppCount.set(m.loser_id, e);
  }
  for (const m of losses) {
    const e = oppCount.get(m.winner_id) ?? { name: m.winner_name, wins: 0, losses: 0 };
    e.losses++;
    oppCount.set(m.winner_id, e);
  }
  const topOpps = [...oppCount.entries()]
    .map(([oid, s]) => ({ id: oid, ...s, total: s.wins + s.losses }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  console.log(`\nMost frequent opponents:`);
  for (const o of topOpps) console.log(`  ${o.total}x ${o.name}  (${o.wins}W–${o.losses}L)`);

  // ---- Biggest wins (wins against opponents with the most total wins) ----
  const oppWinCount = new Map<string, number>();
  for (const m of allMatches) oppWinCount.set(m.winner_id, (oppWinCount.get(m.winner_id) ?? 0) + 1);

  const biggestWins = wins
    .map(m => ({ m, oppWins: oppWinCount.get(m.loser_id) ?? 0 }))
    .sort((a, b) => b.oppWins - a.oppWins)
    .slice(0, 5);
  console.log(`\nBiggest wins (by opponent win count in DB):`);
  for (const { m, oppWins } of biggestWins) {
    console.log(`  beat ${m.loser_name} (${oppWins} career wins)  [${m.tournament_name} | ${m.tournament_date} | ${m.round} | ${m.score}]`);
  }

  // ---- Toughest losses (lost to opponents with most wins) ----
  const toughLosses = losses
    .map(m => ({ m, oppWins: oppWinCount.get(m.winner_id) ?? 0 }))
    .sort((a, b) => b.oppWins - a.oppWins)
    .slice(0, 3);
  console.log(`\nToughest losses (by opponent win count):`);
  for (const { m, oppWins } of toughLosses) {
    console.log(`  lost to ${m.winner_name} (${oppWins} career wins)  [${m.tournament_name} | ${m.tournament_date} | ${m.round} | ${m.score}]`);
  }

  // ---- Longest matches (3-set matches) ----
  const threeSetters = all.filter(m => {
    const sets = m.score.split(",").map(s => s.trim()).filter(s => {
      const parts = s.split("-");
      if (parts.length !== 2) return false;
      const [a, b] = parts.map(Number);
      return !isNaN(a) && !isNaN(b) && a > 0 && b > 0;
    });
    return sets.length >= 3;
  });
  console.log(`\n3-set matches: ${threeSetters.length}`);
  if (threeSetters.length > 0) {
    const ex = threeSetters[0];
    const won = ex.winner_id === id;
    console.log(`  Example: ${won ? "beat" : "lost to"} ${won ? ex.loser_name : ex.winner_name}  [${ex.score}]  ${ex.tournament_name} | ${ex.tournament_date}`);
  }

  // ---- Win streaks at a single tournament ----
  const tournWins = new Map<string, number>();
  for (const m of wins) {
    const key = `${m.tournament_name}|${m.tournament_date}`;
    tournWins.set(key, (tournWins.get(key) ?? 0) + 1);
  }
  const bestTournDay = [...tournWins.entries()].sort((a, b) => b[1] - a[1])[0];
  if (bestTournDay) {
    const [keyStr, count] = bestTournDay;
    const [tName, tDate] = keyStr.split("|");
    console.log(`\nMost wins at one event: ${count} wins  [${tName} | ${tDate}]`);
  }

  // ---- Dominant wins (score spread) ----
  function parseFirstSet(score: string): { a: number; b: number } | null {
    const first = score.split(",")[0]?.trim();
    if (!first) return null;
    const parts = first.split("-").map(Number);
    if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
    return { a: parts[0], b: parts[1] };
  }

  const dominantWins = wins
    .map(m => ({ m, spread: (() => { const s = parseFirstSet(m.score); return s ? s.a - s.b : 0; })() }))
    .filter(x => x.spread > 0)
    .sort((a, b) => b.spread - a.spread)
    .slice(0, 3);
  if (dominantWins.length > 0) {
    console.log(`\nMost dominant wins (first set spread):`);
    for (const { m, spread } of dominantWins) {
      console.log(`  +${spread} vs ${m.loser_name}  [${m.score}]  ${m.tournament_name} | ${m.tournament_date}`);
    }
  }

  // ---- Closest losses (came close) ----
  const closeThreeSet = losses.filter(m => {
    const sets = m.score.split(",").map(s => s.trim());
    return sets.length >= 3;
  });
  console.log(`\nClose 3-set losses: ${closeThreeSet.length}`);

  console.log();
}
