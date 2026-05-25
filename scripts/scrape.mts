/**
 * CLI scraper script
 * Usage: npm run scrape -- --slug player-id
 *        npm run scrape -- --query "John Smith"
 */

import "./load-env.mjs"; // must be first — loads .env.local before supabase initializes
import { scrapePlayerMatches, searchPlayers } from "@/lib/scraper";
import { createServiceClient } from "@/lib/supabase";
import type { Player } from "@/types";

async function main() {
  const args = process.argv.slice(2);
  const slugIndex = args.indexOf("--slug");
  const queryIndex = args.indexOf("--query");

  if (slugIndex === -1 && queryIndex === -1) {
    console.error("Usage: npm run scrape -- --slug <player-slug>");
    console.error("       npm run scrape -- --query <name>");
    process.exit(1);
  }

  const db = createServiceClient();

  if (queryIndex !== -1) {
    const query = args[queryIndex + 1];
    console.log(`Searching for "${query}"...`);
    const players = await searchPlayers(query);
    console.log(`Found ${players.length} players:`);
    players.forEach((p) => console.log(`  ${p.name}  (slug: ${p.slug})`));
    return;
  }

  const slug = args[slugIndex + 1];
  console.log(`Scraping ${slug}...`);

  const { player, matches } = await scrapePlayerMatches(slug);
  console.log(`Found ${matches.length} matches for ${player.name}`);

  // Save player
  const { error: pErr } = await db
    .from("players")
    .upsert(player, { onConflict: "id" });
  if (pErr) console.error("Player upsert error:", pErr.message);

  // Save opponent stubs
  const opponentMap = new Map<string, Player>();
  for (const m of matches) {
    if (m.winner_id !== player.id) {
      opponentMap.set(m.winner_id, {
        id: m.winner_id,
        name: m.winner_name,
        slug: m.winner_id,
        is_pro: false,
        created_at: new Date().toISOString(),
      });
    }
    if (m.loser_id !== player.id) {
      opponentMap.set(m.loser_id, {
        id: m.loser_id,
        name: m.loser_name,
        slug: m.loser_id,
        is_pro: false,
        created_at: new Date().toISOString(),
      });
    }
  }

  if (opponentMap.size > 0) {
    await db
      .from("players")
      .upsert(Array.from(opponentMap.values()), {
        onConflict: "id",
        ignoreDuplicates: true,
      });
  }

  // Save matches
  if (matches.length > 0) {
    const { error: mErr } = await db
      .from("matches")
      .upsert(matches, { onConflict: "id" });
    if (mErr) console.error("Match upsert error:", mErr.message);
    else console.log(`Saved ${matches.length} matches to Supabase.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
