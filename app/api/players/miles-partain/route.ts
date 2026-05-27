import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

const MILES_ID = "1644";

export async function GET() {
  const db = createServiceClient();

  const [
    { data: tournamentResults },
    { data: partnershipRows },
    { data: winsData },
    { data: lossesData },
    { data: bestWins },
    { data: recentMatches },
  ] = await Promise.all([
    db
      .from("tournament_results")
      .select("*")
      .eq("player_id", MILES_ID)
      .order("points", { ascending: false })
      .order("tournament_date", { ascending: false }),

    db
      .from("partnerships")
      .select("*")
      .or(`player_a_id.eq.${MILES_ID},player_b_id.eq.${MILES_ID}`),

    db
      .from("matches")
      .select("id")
      .eq("winner_id", MILES_ID),

    db
      .from("matches")
      .select("id")
      .eq("loser_id", MILES_ID),

    // Best wins: full-set matches (not short quad scores) at named events
    db
      .from("matches")
      .select("*")
      .eq("winner_id", MILES_ID)
      .or("tournament_name.ilike.%AVP%,tournament_name.ilike.%FIVB%,tournament_name.ilike.%BPT%,tournament_name.ilike.%Newport%,tournament_name.ilike.%Hermosa%")
      .not("score", "ilike", "11-%")
      .order("tournament_date", { ascending: false })
      .limit(50),

    db
      .from("matches")
      .select("*")
      .or(`winner_id.eq.${MILES_ID},loser_id.eq.${MILES_ID}`)
      .order("tournament_date", { ascending: false })
      .limit(15),
  ]);

  // Aggregate partnership stats
  const partnerMap = new Map<string, {
    id: string; name: string; events: number; bestFinish: number | null; finishes: number[]; titles: number;
  }>();

  for (const p of partnershipRows ?? []) {
    const isA = p.player_a_id === MILES_ID;
    const partnerId: string = isA ? p.player_b_id : p.player_a_id;
    const partnerName: string = isA ? p.player_b_name : p.player_a_name;

    if (!partnerMap.has(partnerId)) {
      partnerMap.set(partnerId, { id: partnerId, name: partnerName, events: 0, bestFinish: null, finishes: [], titles: 0 });
    }
    const stat = partnerMap.get(partnerId)!;
    stat.events++;
    if (p.finish != null) {
      stat.finishes.push(p.finish);
      if (stat.bestFinish === null || p.finish < stat.bestFinish) stat.bestFinish = p.finish;
      if (p.finish === 1) stat.titles++;
    }
  }

  const partnerships = [...partnerMap.values()]
    .sort((a, b) => b.events - a.events);

  // Tournament stats
  const results = tournamentResults ?? [];
  const knownFinishes = results.filter(r => r.finish != null && r.finish < 99);
  const titles = knownFinishes.filter(r => r.finish === 1).length;
  const podiums = knownFinishes.filter(r => r.finish <= 3).length;
  const topFives = knownFinishes.filter(r => r.finish <= 5).length;

  // Deduplicate best wins by loser name (one win per opponent shown)
  const seenOpponents = new Set<string>();
  const deduped = (bestWins ?? []).filter(m => {
    if (seenOpponents.has(m.loser_id)) return false;
    seenOpponents.add(m.loser_id);
    return true;
  }).slice(0, 12);

  return NextResponse.json({
    player: { id: MILES_ID, name: "Miles Partain", is_pro: true },
    stats: {
      totalMatches: (winsData?.length ?? 0) + (lossesData?.length ?? 0),
      wins: winsData?.length ?? 0,
      losses: lossesData?.length ?? 0,
      tournaments: results.length,
      titles,
      podiums,
      topFives,
      partners: partnerMap.size,
    },
    tournamentResults: results,
    partnerships,
    bestWins: deduped,
    recentMatches: recentMatches ?? [],
  });
}
