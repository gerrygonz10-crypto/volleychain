/**
 * Search for a player on volleyballlife.com, scrape their matches, save to Supabase, find chain to Miles Partain.
 * Usage: PLAYER_NAME="Greg Herceg" npx tsx scripts/scrape-player.mts
 */
import "./load-env.mjs";
import { createServiceClient } from "@/lib/supabase";
import { buildGraph, findShortestChain } from "@/lib/graph";
import { scrapePlayerMatches } from "@/lib/scraper";
import type { Player, Match } from "@/types";

const PLAYER_NAME = process.env.PLAYER_NAME ?? "Greg Herceg";
const MILES_ID = "1644";
const db = createServiceClient();

// 1. Search volleyballlife.com
console.log(`Searching volleyballlife.com for "${PLAYER_NAME}"...`);
const query = encodeURIComponent(PLAYER_NAME);
const searchRes = await fetch(`https://api-v8.volleyballlife.com/playerprofile/search/${query}`);
if (!searchRes.ok) throw new Error(`Search failed: ${searchRes.status}`);
const searchData = await searchRes.json() as { id: number; fullName: string; cityState?: string | null }[];
if (!searchData || searchData.length === 0) {
  console.log("No results found.");
  process.exit(1);
}
console.log(`Found ${searchData.length} result(s):`);
for (const p of searchData.slice(0, 10)) {
  console.log(`  ID ${p.id}: ${p.fullName}  (${p.cityState ?? ""})`);
}

// Pick the result with most tournaments (check profiles)
let bestId = searchData[0].id;
let bestCount = -1;
for (const p of searchData) {
  const r = await fetch(`https://api-v8.volleyballlife.com/playerprofile/${p.id}`);
  if (!r.ok) continue;
  const prof = await r.json() as { tournaments?: unknown[] };
  const count = prof.tournaments?.length ?? 0;
  console.log(`  Checking ID ${p.id} (${p.fullName}): ${count} tournament(s)`);
  if (count > bestCount) { bestCount = count; bestId = p.id; }
}

const target = searchData.find(p => p.id === bestId)!;
const SLUG = String(bestId);
console.log(`\nUsing: ${target.fullName} (ID ${SLUG})`);

// 2. Scrape matches
console.log("\nScraping match history...");
const { player: scrapedPlayer, matches: scrapedMatches } = await scrapePlayerMatches(SLUG);
console.log(`Scraped ${scrapedMatches.length} match records`);

// 3. Upsert player
if (scrapedPlayer) {
  const { error: pErr } = await db.from("players").upsert([scrapedPlayer], { onConflict: "id" });
  if (pErr) console.error("Player upsert error:", pErr.message);
  else console.log(`Upserted player: ${scrapedPlayer.name}`);
}

// 4. Upsert matches in batches
if (scrapedMatches.length > 0) {
  const BATCH = 500;
  let saved = 0;
  for (let i = 0; i < scrapedMatches.length; i += BATCH) {
    const batch = scrapedMatches.slice(i, i + BATCH);
    const { error: mErr } = await db.from("matches").upsert(batch, { onConflict: "id" });
    if (mErr) { console.error(`Match upsert error (batch ${i}):`, mErr.message); break; }
    saved += batch.length;
  }
  console.log(`Upserted ${saved} matches`);
}

// 5. Load full graph and find chain
console.log("\nLoading match graph for chain search...");
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
console.log(`Loaded ${allMatches.length.toLocaleString()} total matches\n`);

const playerMap = new Map<string, Player>();
for (const m of allMatches) {
  if (!playerMap.has(m.winner_id)) playerMap.set(m.winner_id, { id: m.winner_id, name: m.winner_name, slug: m.winner_id, is_pro: false, created_at: "" });
  if (!playerMap.has(m.loser_id))  playerMap.set(m.loser_id,  { id: m.loser_id,  name: m.loser_name,  slug: m.loser_id,  is_pro: false, created_at: "" });
}
const graph = buildGraph([...playerMap.values()], allMatches);

const wins   = allMatches.filter(m => m.winner_id === SLUG);
const losses = allMatches.filter(m => m.loser_id  === SLUG);
console.log(`${target.fullName} in DB: ${wins.length}W – ${losses.length}L`);

const chain = findShortestChain(graph, SLUG, new Set([MILES_ID]));
if (!chain) {
  console.log("Chain to Miles Partain: NOT FOUND");
} else {
  console.log(`Chain to Miles Partain: ${chain.degrees} degree(s)`);
  for (const link of chain.chain) {
    console.log(`  ${link.winner.name} beat ${link.loser.name}  [${link.match.tournament_name} | ${link.match.tournament_date} | ${link.match.round} | ${link.match.score}]`);
  }
}
