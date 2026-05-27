"use client";

import { useEffect, useState } from "react";

interface TournamentResult {
  id: string;
  tournament_name: string;
  tournament_date: string;
  division: string;
  finish: number | null;
  partner_names: string[];
}

interface Partnership {
  id: string;
  name: string;
  events: number;
  bestFinish: number | null;
  titles: number;
  finishes: number[];
}

interface Match {
  id: string;
  tournament_name: string;
  tournament_date: string;
  round: string;
  winner_id: string;
  loser_id: string;
  winner_name: string;
  loser_name: string;
  score: string;
}

interface ProfileData {
  player: { id: string; name: string; is_pro: boolean };
  stats: {
    totalMatches: number;
    wins: number;
    losses: number;
    tournaments: number;
    titles: number;
    podiums: number;
    topFives: number;
    partners: number;
  };
  tournamentResults: TournamentResult[];
  partnerships: Partnership[];
  bestWins: Match[];
  recentMatches: Match[];
}

function finishBadge(finish: number | null) {
  if (finish === null) return null;
  if (finish === 1)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gold-500/15 text-gold-400 border border-gold-500/30">
        1st Place
      </span>
    );
  if (finish === 2)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-400/15 text-slate-300 border border-slate-400/30">
        Runner-Up
      </span>
    );
  if (finish === 3 || finish === 4)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-700/15 text-amber-500 border border-amber-700/30">
        {finish === 3 ? "3rd Place" : "4th Place"}
      </span>
    );
  if (finish === 99)
    return (
      <span className="text-xs px-2.5 py-0.5 rounded-full bg-court-600 text-court-500 border border-court-500">
        DNF
      </span>
    );
  return (
    <span className="text-xs px-2.5 py-0.5 rounded-full bg-court-700 text-court-400 border border-court-600">
      {finish}th
    </span>
  );
}

function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-bold text-sand-100">{value}</div>
      <div className="text-court-400 text-xs uppercase tracking-wider mt-1">{label}</div>
      {sub && <div className="text-court-500 text-xs mt-0.5">{sub}</div>}
    </div>
  );
}

export default function MilesPartainPage() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllTournaments, setShowAllTournaments] = useState(false);

  useEffect(() => {
    fetch("/api/players/miles-partain")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gold-400">
          <div className="w-5 h-5 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading profile...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { stats, tournamentResults, partnerships, bestWins, recentMatches } = data;
  const winPct = stats.totalMatches > 0 ? Math.round((stats.wins / stats.totalMatches) * 100) : 0;
  const visibleTournaments = showAllTournaments ? tournamentResults : tournamentResults.slice(0, 15);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">

      {/* Hero */}
      <div className="relative card p-8 mb-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gold-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-4xl font-bold text-sand-100">Miles Partain</h1>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gold-500/20 text-gold-400 border border-gold-500/30">
                PRO
              </span>
            </div>
            <p className="text-court-400 text-sm">
              Professional Beach Volleyball — USA National Team
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <a
              href="https://volleyballlife.com/profile/1644"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost text-xs px-3 py-1.5"
            >
              Volleyball Life ↗
            </a>
          </div>
        </div>

        {/* Win % bar */}
        <div className="mt-6">
          <div className="flex justify-between text-xs text-court-400 mb-1.5">
            <span>{stats.wins.toLocaleString()} wins</span>
            <span>{winPct}% win rate</span>
            <span>{stats.losses.toLocaleString()} losses</span>
          </div>
          <div className="w-full h-1.5 bg-court-600 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-gold-500 to-gold-400 rounded-full"
              style={{ width: `${winPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="card p-6 mb-6">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-6 divide-x divide-court-600">
          <StatBox label="Tournaments" value={stats.tournaments} />
          <StatBox label="Titles" value={stats.titles} />
          <StatBox label="Podiums" value={stats.podiums} sub="Top 3" />
          <StatBox label="Top 5s" value={stats.topFives} />
          <StatBox label="Partners" value={stats.partners} />
          <StatBox label="Match Records" value={stats.totalMatches.toLocaleString()} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">

        {/* Tournament Results */}
        <div className="lg:col-span-3 card p-5">
          <h2 className="text-sm font-semibold text-sand-300 uppercase tracking-wider mb-4">
            Tournament History
          </h2>
          <div className="space-y-2">
            {visibleTournaments.map((r) => (
              <div
                key={r.id}
                className="flex items-start gap-3 py-2.5 border-b border-court-700 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sand-200 text-sm font-medium truncate">{r.tournament_name}</div>
                  <div className="text-court-400 text-xs mt-0.5 flex items-center gap-2">
                    <span>{r.tournament_date ? new Date(r.tournament_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</span>
                    {r.division && <span className="text-court-600">·</span>}
                    {r.division && <span>{r.division}</span>}
                  </div>
                  {r.partner_names?.length > 0 && (
                    <div className="text-court-500 text-xs mt-0.5">
                      w/ {r.partner_names.join(", ")}
                    </div>
                  )}
                </div>
                <div className="shrink-0">{finishBadge(r.finish)}</div>
              </div>
            ))}
          </div>
          {tournamentResults.length > 15 && (
            <button
              onClick={() => setShowAllTournaments((v) => !v)}
              className="mt-3 text-xs text-gold-400 hover:text-gold-300 transition-colors"
            >
              {showAllTournaments
                ? "Show less"
                : `Show all ${tournamentResults.length} tournaments`}
            </button>
          )}
        </div>

        {/* Partnership History */}
        <div className="lg:col-span-2 card p-5">
          <h2 className="text-sm font-semibold text-sand-300 uppercase tracking-wider mb-4">
            Partners
          </h2>
          <div className="space-y-2">
            {partnerships.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 py-2 border-b border-court-700 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sand-200 text-sm font-medium truncate">{p.name}</div>
                  <div className="text-court-400 text-xs mt-0.5">
                    {p.events} {p.events === 1 ? "event" : "events"}
                    {p.titles > 0 && (
                      <span className="ml-2 text-gold-400 font-medium">
                        {p.titles} {p.titles === 1 ? "title" : "titles"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {p.bestFinish != null && finishBadge(p.bestFinish)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Best Wins */}
      {bestWins.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="text-sm font-semibold text-sand-300 uppercase tracking-wider mb-4">
            Notable Wins
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {bestWins.map((m) => (
              <div
                key={m.id}
                className="bg-court-700 rounded-lg p-3.5 border border-court-600 hover:border-court-500 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="text-sand-200 text-sm font-medium">def. {m.loser_name}</div>
                  <span className="badge-win shrink-0">W</span>
                </div>
                <div className="text-gold-400 text-xs font-mono font-medium mb-1">{m.score}</div>
                <div className="text-court-400 text-xs truncate">{m.tournament_name}</div>
                <div className="text-court-500 text-xs mt-0.5 flex items-center gap-2">
                  <span>{m.round}</span>
                  <span>·</span>
                  <span>{m.tournament_date ? new Date(m.tournament_date).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : ""}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Matches */}
      {recentMatches.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-sand-300 uppercase tracking-wider mb-4">
            Recent Matches
          </h2>
          <div className="space-y-2">
            {recentMatches.map((m) => {
              const won = m.winner_id === "1644";
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 py-2 border-b border-court-700 last:border-0"
                >
                  <span className={won ? "badge-win" : "badge-loss"}>
                    {won ? "W" : "L"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sand-200 text-sm">
                      {won ? (
                        <>def. <span className="font-medium">{m.loser_name}</span></>
                      ) : (
                        <>lost to <span className="font-medium">{m.winner_name}</span></>
                      )}
                    </div>
                    <div className="text-court-400 text-xs mt-0.5 truncate">{m.tournament_name}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-gold-400 text-xs font-mono">{m.score}</div>
                    <div className="text-court-500 text-xs">{m.round}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
