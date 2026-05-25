import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { buildGraph, findShortestChain } from "@/lib/graph";
import type { Player, Match } from "@/types";

export async function GET(req: NextRequest) {
  const playerSlug = req.nextUrl.searchParams.get("player");
  const targetName = req.nextUrl.searchParams.get("target");

  if (!playerSlug || !targetName) {
    return NextResponse.json(
      { error: "Missing player or target param" },
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

  // Fetch target pro(s) by name
  const { data: targetRows } = await supabase
    .from("players")
    .select("*")
    .ilike("name", `%${targetName}%`)
    .limit(5);

  const targetIds = new Set<string>(
    (targetRows ?? []).map((p: Player) => p.id)
  );

  if (targetIds.size === 0) {
    return NextResponse.json({ result: null });
  }

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
