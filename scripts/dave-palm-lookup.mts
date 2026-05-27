import "./load-env.mjs";
import { createServiceClient } from "@/lib/supabase";

const db = createServiceClient();
const DAVE_ID = "16614";

// Find Evan Cory's player ID
const { data: evanCoryPlayers } = await db.from("players").select("id, name")
  .ilike("name", "%Evan%").ilike("name", "%Cory%");
console.log("Evan Cory search:", JSON.stringify(evanCoryPlayers));

// Find Andy players (context: Michigan doubles, likely Andy Nguyen)
const { data: andyPlayers } = await db.from("players").select("id, name")
  .ilike("name", "%Andy%").limit(20);
console.log("\nAndy search:", JSON.stringify(andyPlayers));

// All of Dave Palm's wins
const { data: daveWins } = await db.from("matches").select("*")
  .eq("winner_id", DAVE_ID);
console.log(`\nDave Palm wins: ${daveWins?.length ?? 0}`);
if (daveWins && daveWins.length > 0) {
  for (const m of daveWins) {
    console.log(`  beat ${m.loser_name}  [${m.tournament_name} | ${m.tournament_date} | ${m.round} | ${m.score}]`);
  }
}

// All of Dave Palm's losses
const { data: daveLosses } = await db.from("matches").select("*")
  .eq("loser_id", DAVE_ID);
console.log(`\nDave Palm losses: ${daveLosses?.length ?? 0}`);
if (daveLosses && daveLosses.length > 0) {
  for (const m of daveLosses) {
    console.log(`  lost to ${m.winner_name}  [${m.tournament_name} | ${m.tournament_date} | ${m.round} | ${m.score}]`);
  }
}

// Check for any Michigan tournaments in the full DB
console.log("\n--- Michigan tournaments Dave Palm appears in ---");
const allDave = [...(daveWins ?? []), ...(daveLosses ?? [])];
const michiganMatches = allDave.filter(m =>
  m.tournament_name?.toLowerCase().includes("michigan") ||
  m.tournament_name?.toLowerCase().includes(" mi ") ||
  m.tournament_name?.toLowerCase().includes("grand rapids") ||
  m.tournament_name?.toLowerCase().includes("detroit") ||
  m.tournament_name?.toLowerCase().includes("lansing") ||
  m.tournament_name?.toLowerCase().includes("traverse")
);
if (michiganMatches.length === 0) {
  console.log("No Michigan tournaments found for Dave Palm");
} else {
  for (const m of michiganMatches) {
    console.log(`  ${m.tournament_name} | ${m.tournament_date}`);
  }
}
