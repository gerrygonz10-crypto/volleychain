"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PlayerSearch from "@/components/PlayerSearch";
import HeadToHeadCard from "@/components/HeadToHeadCard";
import type { Player, HeadToHeadRecord } from "@/types";

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const params = useSearchParams();
  const [player, setPlayer] = useState<Player | null>(null);
  const [records, setRecords] = useState<HeadToHeadRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (p: Player) => {
    setLoading(true);
    setError(null);
    setPlayer(p);

    try {
      const res = await fetch(`/api/dashboard?player=${p.slug}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRecords(data.records ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load from URL param on mount
  useEffect(() => {
    const slug = params.get("player");
    if (slug && !player) {
      loadDashboard({ id: slug, name: slug, slug, is_pro: false, created_at: "" });
    }
  }, [params, player, loadDashboard]);

  const totalWins = records.reduce((s, r) => s + r.wins, 0);
  const totalLosses = records.reduce((s, r) => s + r.losses, 0);
  const winPct =
    totalWins + totalLosses > 0
      ? Math.round((totalWins / (totalWins + totalLosses)) * 100)
      : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-sand-100 mb-1">Match Dashboard</h1>
      <p className="text-court-400 mb-8 text-sm">
        Head-to-head records from tournament play
      </p>

      <div className="mb-8 max-w-md">
        <PlayerSearch
          onSelect={loadDashboard}
          placeholder="Search player..."
          initialSlug={params.get("player") ?? undefined}
        />
      </div>

      {player && !loading && records.length > 0 && (
        <>
          {/* Summary bar */}
          <div className="card p-5 mb-6 flex flex-wrap gap-6 items-center">
            <div>
              <div className="text-2xl font-bold text-sand-100">{player.name || player.slug}</div>
              <div className="text-court-400 text-sm">Tournament record</div>
            </div>
            <div className="flex gap-6 ml-auto">
              <Stat label="Wins" value={totalWins} color="text-emerald-400" />
              <Stat label="Losses" value={totalLosses} color="text-red-400" />
              <Stat label="Win %" value={`${winPct}%`} color="text-gold-400" />
              <Stat label="Opponents" value={records.length} color="text-sand-300" />
            </div>
          </div>

          {/* Win % bar */}
          <div className="w-full h-2 bg-court-600 rounded-full mb-8 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-gold-400 rounded-full transition-all duration-700"
              style={{ width: `${winPct}%` }}
            />
          </div>

          {/* H2H cards */}
          <div className="space-y-3">
            {records.map((record) => (
              <HeadToHeadCard key={record.opponent.id} record={record} />
            ))}
          </div>
        </>
      )}

      {loading && <LoadingState />}

      {error && (
        <div className="card p-6 text-red-400 text-sm border-red-900/50">
          {error}
        </div>
      )}

      {!loading && !error && player && records.length === 0 && (
        <div className="card p-10 text-center text-court-400">
          No match records found for this player.
        </div>
      )}

      {!player && !loading && (
        <div className="card p-10 text-center text-court-400">
          Search for a player above to see their match record.
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-court-400 text-xs mt-0.5">{label}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="card p-5 animate-pulse"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="flex items-center gap-4">
            <div className="w-36 h-5 bg-court-600 rounded" />
            <div className="ml-auto flex gap-4">
              <div className="w-12 h-5 bg-court-600 rounded" />
              <div className="w-12 h-5 bg-court-600 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
