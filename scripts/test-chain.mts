import "./load-env.mjs";
import { createServiceClient } from "@/lib/supabase";
import { buildGraph, findShortestChain } from "@/lib/graph";
import type { Player, Match } from "@/types";

const FROM_ID = "59414";
const TO_ID = "1644"; // Miles Partain

const db = createServiceClient();

console.log("Loading all matches from Supabase...");

// Fetch all matches (paginated)
const allMatches: Match[] = [];
let offset = 0;
const PAGE = 1000;
while (true) {
  const { data, error } = await db
    .from("matches")
    .select("*")
    .range(offset, offset + PAGE - 1);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) break;
  allMatches.push(...(data as Match[]));
  if (data.length < PAGE) break;
  offset += PAGE;
  if (offset % 50000 === 0) console.log(`  ...loaded ${offset} matches so far`);
}
console.log(`Loaded ${allMatches.length.toLocaleString()} matches`);

// Collect all player IDs referenced in matches
const playerIds = new Set<string>();
for (const m of allMatches) {
  playerIds.add(m.winner_id);
  playerIds.add(m.loser_id);
}

// Fetch players in batches
console.log(`Fetching ${playerIds.size.toLocaleString()} players...`);
const allPlayers: Player[] = [];
const idList = [...playerIds];
for (let i = 0; i < idList.length; i += 500) {
  const batch = idList.slice(i, i + 500);
  const { data } = await db.from("players").select("*").in("id", batch);
  if (data) allPlayers.push(...(data as Player[]));
}
console.log(`Loaded ${allPlayers.length.toLocaleString()} players`);

const graph = buildGraph(allPlayers, allMatches);

console.log(`\nSearching for chain: ${FROM_ID} → ${TO_ID} (Miles Partain)...`);
const result = findShortestChain(graph, FROM_ID, new Set([TO_ID]));

if (!result) {
  console.log("No chain found.");
} else {
  console.log(`\nChain found! ${result.degrees} degree(s):`);
  console.log(`  Start: ${result.player.name} (${FROM_ID})`);
  for (const link of result.chain) {
    console.log(
      `  ${link.winner.name} beat ${link.loser.name}  [${link.match.tournament_name}, ${link.match.tournament_date}, ${link.match.score}]`
    );
  }
  console.log(`  End: Miles Partain (${TO_ID})`);
}
