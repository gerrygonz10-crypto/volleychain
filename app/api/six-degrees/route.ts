import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { buildGraph, findShortestChain } from "@/lib/graph";
import type { Player, Match } from "@/types";

const MILES_PARTAIN_ID = "1644";
const PAGE_SIZE = 1000;

export async function GET(req: NextRequest) {
  const playerSlug = req.nextUrl.searchParams.get("player");

  if (!playerSlug) {
    return NextResponse.json(
      { error: "Missing player param" },
      { status: 400 }
    );
  }

  // Fetch starting player
  const { data: playerRows } = await supabase
    .from("players")
    .select("*")
    .eq("slug", playerSlug)
    .limit(1);

  const startPlayer: Player | null = playerRows?.[0] ?? null;
  if (!startPlayer) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const targetIds = new Set<string>([MILES_PARTAIN_ID]);

  // Paginate through ALL matches — Supabase caps single responses at ~1k rows,
  // so .limit(50000) was silently truncated and the BFS graph was incomplete.
  const allMatches: Match[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    allMatches.push(...(data as Match[]));
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  // Build player stubs from match data — every player in a match is present
  // here, so BFS never hits a missing-player gap that silently breaks chains.
  const playerMap = new Map<string, Player>();
  for (const m of allMatches) {
    if (!playerMap.has(m.winner_id)) {
      playerMap.set(m.winner_id, {
        id: m.winner_id,
        name: m.winner_name,
        slug: m.winner_id,
        is_pro: false,
        created_at: "",
      });
    }
    if (!playerMap.has(m.loser_id)) {
      playerMap.set(m.loser_id, {
        id: m.loser_id,
        name: m.loser_name,
        slug: m.loser_id,
        is_pro: false,
        created_at: "",
      });
    }
  }
  // Keep the real player record for the start player (has accurate slug, is_pro, etc.)
  playerMap.set(startPlayer.id, startPlayer);

  const graph = buildGraph([...playerMap.values()], allMatches);

  const result = findShortestChain(graph, startPlayer.id, targetIds);

  return NextResponse.json({ result });
}
