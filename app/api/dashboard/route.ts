import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { buildHeadToHeadRecords } from "@/lib/graph";
import type { Player, Match } from "@/types";

export async function GET(req: NextRequest) {
  const playerSlug = req.nextUrl.searchParams.get("player");

  if (!playerSlug) {
    return NextResponse.json({ error: "Missing player param" }, { status: 400 });
  }

  // Look up the player
  const { data: playerRows, error: pErr } = await supabase
    .from("players")
    .select("*")
    .eq("slug", playerSlug)
    .limit(1);

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const player: Player | null = playerRows?.[0] ?? null;

  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  // Fetch all matches involving this player
  const { data: matchRows, error: mErr } = await supabase
    .from("matches")
    .select("*")
    .or(`winner_id.eq.${player.id},loser_id.eq.${player.id}`)
    .order("tournament_date", { ascending: false });

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  const matches: Match[] = matchRows ?? [];

  // Collect all opponent IDs
  const opponentIds = new Set<string>();
  for (const m of matches) {
    if (m.winner_id === player.id) opponentIds.add(m.loser_id);
    if (m.loser_id === player.id) opponentIds.add(m.winner_id);
  }

  // Fetch opponent player records
  const { data: opponentRows } = await supabase
    .from("players")
    .select("*")
    .in("id", Array.from(opponentIds));

  const playerMap = new Map<string, Player>(
    (opponentRows ?? []).map((p: Player) => [p.id, p])
  );

  const records = buildHeadToHeadRecords(player.id, matches, playerMap);

  return NextResponse.json({ player, records });
}
