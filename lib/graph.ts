/**
 * Six-degrees graph engine
 *
 * Uses BFS over the match graph to find the shortest win-chain
 * connecting a player to any top AVP pro.
 */

import type { Match, Player, ChainLink, ChainResult } from "@/types";

interface MatchGraph {
  // winnerId -> [{ loserId, match }]
  edges: Map<string, Array<{ loserId: string; match: Match }>>;
  players: Map<string, Player>;
}

export function buildGraph(players: Player[], matches: Match[]): MatchGraph {
  const edges = new Map<string, Array<{ loserId: string; match: Match }>>();
  const playerMap = new Map<string, Player>(players.map((p) => [p.id, p]));

  for (const match of matches) {
    if (!edges.has(match.winner_id)) {
      edges.set(match.winner_id, []);
    }
    edges.get(match.winner_id)!.push({ loserId: match.loser_id, match });
  }

  return { edges, players: playerMap };
}

/**
 * BFS: find shortest chain of wins from `startId` to any player in `targetIds`.
 * Direction: startId beat someone, who beat someone, ... who beat a pro.
 */
export function findShortestChain(
  graph: MatchGraph,
  startId: string,
  targetIds: Set<string>
): ChainResult | null {
  if (targetIds.has(startId)) {
    const player = graph.players.get(startId);
    if (!player) return null;
    return { player, target: player, chain: [], degrees: 0 };
  }

  // BFS
  const queue: Array<{ id: string; path: ChainLink[] }> = [
    { id: startId, path: [] },
  ];
  const visited = new Set<string>([startId]);

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    const neighbors = graph.edges.get(id) ?? [];

    for (const { loserId, match } of neighbors) {
      if (visited.has(loserId)) continue;
      visited.add(loserId);

      const winner = graph.players.get(match.winner_id);
      const loser = graph.players.get(match.loser_id);
      if (!winner || !loser) continue;

      const newPath: ChainLink[] = [...path, { winner, loser, match }];

      if (targetIds.has(loserId)) {
        const startPlayer = graph.players.get(startId)!;
        const targetPlayer = graph.players.get(loserId)!;
        return {
          player: startPlayer,
          target: targetPlayer,
          chain: newPath,
          degrees: newPath.length,
        };
      }

      queue.push({ id: loserId, path: newPath });
    }
  }

  return null; // no chain found
}

/**
 * Head-to-head: aggregate wins/losses between two players.
 */
export function getHeadToHead(
  playerId: string,
  opponentId: string,
  matches: Match[]
) {
  const relevant = matches.filter(
    (m) =>
      (m.winner_id === playerId && m.loser_id === opponentId) ||
      (m.winner_id === opponentId && m.loser_id === playerId)
  );

  const wins = relevant.filter((m) => m.winner_id === playerId).length;
  const losses = relevant.filter((m) => m.loser_id === playerId).length;

  return { wins, losses, matches: relevant };
}

/**
 * Build full head-to-head records for a player against all opponents.
 */
export function buildHeadToHeadRecords(
  playerId: string,
  allMatches: Match[],
  players: Map<string, Player>
) {
  const opponentIds = new Set<string>();

  for (const m of allMatches) {
    if (m.winner_id === playerId) opponentIds.add(m.loser_id);
    if (m.loser_id === playerId) opponentIds.add(m.winner_id);
  }

  const records = [];

  for (const opponentId of opponentIds) {
    const opponent = players.get(opponentId);
    if (!opponent) continue;
    const h2h = getHeadToHead(playerId, opponentId, allMatches);
    records.push({ opponent, ...h2h });
  }

  // Sort by total games (most played first)
  records.sort((a, b) => b.wins + b.losses - (a.wins + a.losses));

  return records;
}
