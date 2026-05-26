import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { buildGraph, findShortestChain } from "@/lib/graph";
import type { Player, Match } from "@/types";

const MILES_PARTAIN_ID = "1644";

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

  // Fetch all matches (BFS needs the full graph — limit 50k rows)
  const { data: allMatches, error: mErr } = await supabase
    .from("matches")
    .select("*")
    .limit(50000);

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  // Fetch all players for name resolution
  const { data: allPlayers } = await supabase
    .from("players")
    .select("*")
    .limit(10000);

  const graph = buildGraph(allPlayers ?? [], allMatches as Match[] ?? []);

  const result = findShortestChain(graph, startPlayer.id, targetIds);

  return NextResponse.json({ result });
}
