import { NextRequest, NextResponse } from "next/server";
import { scrapePlayerMatches } from "@/lib/scraper";
import { createServiceClient } from "@/lib/supabase";

// POST /api/scrape { slug: "player-slug" }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const slug: string = body.slug ?? "";

  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  try {
    const { player, matches } = await scrapePlayerMatches(slug);
    const db = createServiceClient();

    // Upsert player
    await db.from("players").upsert(player, { onConflict: "id" });

    // Upsert opponent players (name-only stubs, updated later if scraped)
    const opponentStubs = [
      ...new Map(
        matches.flatMap((m) => {
          const stubs = [];
          if (m.winner_id !== player.id) {
            stubs.push([
              m.winner_id,
              {
                id: m.winner_id,
                name: m.winner_name,
                slug: m.winner_id,
                is_pro: false,
                created_at: new Date().toISOString(),
              },
            ]);
          }
          if (m.loser_id !== player.id) {
            stubs.push([
              m.loser_id,
              {
                id: m.loser_id,
                name: m.loser_name,
                slug: m.loser_id,
                is_pro: false,
                created_at: new Date().toISOString(),
              },
            ]);
          }
          return stubs;
        })
      ).values(),
    ];

    if (opponentStubs.length > 0) {
      await db
        .from("players")
        .upsert(opponentStubs, { onConflict: "id", ignoreDuplicates: true });
    }

    // Upsert matches
    if (matches.length > 0) {
      await db.from("matches").upsert(matches, { onConflict: "id" });
    }

    return NextResponse.json({
      ok: true,
      player: player.name,
      matchesScraped: matches.length,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Scrape failed" },
      { status: 500 }
    );
  }
}
