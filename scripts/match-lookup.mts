import "./load-env.mjs";
import { createServiceClient } from "@/lib/supabase";
import { buildGraph, findShortestChain } from "@/lib/graph";
import type { Player, Match } from "@/types";

const db = createServiceClient();
const MILES_ID = "1644";

const targets = [
  { name: "Greg Herceg", id: "239112" },
];

// Load full match graph
console.log("Loading match graph...");
const allMatches: Match[] = [];
let offset = 0;
while (true) {
  const { data, error } = await db.from("matches").select("*").order("id").range(offset, offset + 999);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) break;
  allMatches.push(...(data as Match[]));
  if (data.length < 1000) break;
  offset += 1000;
  if (offset % 100000 === 0) console.log(`  ...${offset.toLocaleString()} loaded`);
}
console.log(`Loaded ${allMatches.length.toLocaleString()} matches\n`);

const playerMap = new Map<string, Player>();
for (const m of allMatches) {
  if (!playerMap.has(m.winner_id)) playerMap.set(m.winner_id, { id: m.winner_id, name: m.winner_name, slug: m.winner_id, is_pro: false, created_at: "" });
  if (!playerMap.has(m.loser_id))  playerMap.set(m.loser_id,  { id: m.loser_id,  name: m.loser_name,  slug: m.loser_id,  is_pro: false, created_at: "" });
}

const graph = buildGraph([...playerMap.values()], allMatches);

for (const { name, id } of targets) {
  console.log(`--- ${name} (${id}) ---`);
  const result = findShortestChain(graph, id, new Set([MILES_ID]));
  if (!result) {
    const wins  = allMatches.filter(m => m.winner_id === id).length;
    const losses = allMatches.filter(m => m.loser_id  === id).length;
    console.log(`No chain found. (${wins} win records, ${losses} loss records in DB)`);
  } else {
    console.log(`${result.degrees} degree(s):`);
    for (const link of result.chain) {
      console.log(`  ${link.winner.name} beat ${link.loser.name}  [${link.match.tournament_name} | ${link.match.tournament_date} | ${link.match.round} | ${link.match.score}]`);
    }
  }
  console.log();
}
