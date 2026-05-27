/**
 * BFS scrape from a root player outward N levels.
 * Usage: npm run scrape:bfs -- --slug 59414 --levels 3
 *
 * Level 0: root player (must already be scraped in DB)
 * Level 1: all opponents found in root's DB matches
 * Level 2: all opponents of level-1 players, newly discovered
 */

import "./load-env.mjs";
import { scrapePlayerMatches } from "@/lib/scraper";
import { createServiceClient } from "@/lib/supabase";
import type { Player, Match } from "@/types";

const BATCH_UPSERT_SIZE = 500;

type DB = ReturnType<typeof createServiceClient>;

async function getOpponentsFromDB(db: DB, playerId: string): Promise<Set<string>> {
  const opponents = new Set<string>();
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await db
      .from("matches")
      .select("winner_id, loser_id")
      .or(`winner_id.eq.${playerId},loser_id.eq.${playerId}`)
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(`DB query failed: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      if (row.winner_id !== playerId) opponents.add(row.winner_id);
      if (row.loser_id !== playerId) opponents.add(row.loser_id);
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return opponents;
}

async function savePlayerData(db: DB, player: Player, matches: Match[]) {
  // upsert the scraped player
  const { error: pErr } = await db
    .from("players")
    .upsert(player, { onConflict: "id" });
  if (pErr) console.error(`  Player upsert error (${player.id}): ${pErr.message}`);

  // collect opponent stubs
  const opponentMap = new Map<string, Player>();
  for (const m of matches) {
    for (const [id, name] of [
      [m.winner_id, m.winner_name],
      [m.loser_id, m.loser_name],
    ] as [string, string][]) {
      if (id !== player.id && !opponentMap.has(id)) {
        opponentMap.set(id, {
          id,
          name,
          slug: id,
          is_pro: false,
          created_at: new Date().toISOString(),
        });
      }
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

  // upsert matches in batches
  for (let i = 0; i < matches.length; i += BATCH_UPSERT_SIZE) {
    const batch = matches.slice(i, i + BATCH_UPSERT_SIZE);
    const { error: mErr } = await db
      .from("matches")
      .upsert(batch, { onConflict: "id" });
    if (mErr) console.error(`  Match upsert error: ${mErr.message}`);
  }
}

async function scrapeAndSave(
  db: DB,
  slug: string,
  label: string
): Promise<{ opponentIds: Set<string> }> {
  let player: Player;
  let matches: Match[];

  try {
    ({ player, matches } = await scrapePlayerMatches(slug));
  } catch (err) {
    console.error(`  [${label}] FAILED to scrape: ${err}`);
    return { opponentIds: new Set() };
  }

  await savePlayerData(db, player, matches);

  const opponentIds = new Set<string>();
  for (const m of matches) {
    if (m.winner_id !== slug) opponentIds.add(m.winner_id);
    if (m.loser_id !== slug) opponentIds.add(m.loser_id);
  }

  console.log(`  [${label}] ${player.name} — ${matches.length} match records, ${opponentIds.size} opponents`);
  return { opponentIds };
}

async function main() {
  const args = process.argv.slice(2);
  const slugIdx = args.indexOf("--slug");
  const levelsIdx = args.indexOf("--levels");

  const rootSlug = slugIdx !== -1 ? args[slugIdx + 1] : "59414";
  const maxLevels = levelsIdx !== -1 ? Number(args[levelsIdx + 1]) : 3;

  const db = createServiceClient();

  console.log(`\nBFS scrape: root=${rootSlug}, levels=${maxLevels}`);
  console.log("=".repeat(60));

  // Track which slugs have been fully scraped this run
  const scraped = new Set<string>([rootSlug]);
  // Each level's player IDs
  const levelSets: Set<string>[] = [new Set([rootSlug])];

  // Level 0 is already in DB — fetch its opponents from DB
  console.log(`\nLevel 0: ${rootSlug} (already in DB — reading opponents...)`);
  const level1Ids = await getOpponentsFromDB(db, rootSlug);
  console.log(`  Found ${level1Ids.size} level-1 opponents in DB`);

  levelSets.push(level1Ids);

  for (let level = 1; level < maxLevels; level++) {
    const currentLevel = levelSets[level];
    const toScrape = [...currentLevel].filter((id) => !scraped.has(id));

    console.log(`\nLevel ${level}: ${toScrape.length} players to scrape`);
    console.log("-".repeat(60));

    const nextLevelIds = new Set<string>();
    let done = 0;

    for (const slug of toScrape) {
      done++;
      const label = `L${level} ${done}/${toScrape.length}`;
      const { opponentIds } = await scrapeAndSave(db, slug, label);
      scraped.add(slug);

      for (const id of opponentIds) {
        if (!scraped.has(id)) nextLevelIds.add(id);
      }
    }

    console.log(`\nLevel ${level} complete — discovered ${nextLevelIds.size} new level-${level + 1} opponents`);
    levelSets.push(nextLevelIds);
  }

  console.log("\n" + "=".repeat(60));
  console.log(`BFS complete. Total players scraped: ${scraped.size}`);
  console.log(`Levels processed: ${maxLevels}`);
  for (let i = 0; i < levelSets.length; i++) {
    console.log(`  Level ${i}: ${levelSets[i].size} players`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
