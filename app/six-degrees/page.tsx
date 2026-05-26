"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PlayerSearch from "@/components/PlayerSearch";
import ChainVisualization from "@/components/ChainVisualization";
import type { Player, ChainResult } from "@/types";

export default function SixDegreesPage() {
  return (
    <Suspense>
      <SixDegreesContent />
    </Suspense>
  );
}

function SixDegreesContent() {
  const params = useSearchParams();
  const [player, setPlayer] = useState<Player | null>(null);
  const [result, setResult] = useState<ChainResult | null>(null);
  const [chainKey, setChainKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const findChain = async (p: Player) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setSearched(true);
    setPlayer(p);

    try {
      const res = await fetch(`/api/six-degrees?player=${p.slug}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data.result ?? null);
      setChainKey((k) => k + 1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to find chain");
    } finally {
      setLoading(false);
    }
  };

  // Auto-load from URL
  useEffect(() => {
    const slug = params.get("player");
    if (slug && !player) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      findChain({ id: slug, name: slug, slug, is_pro: false, created_at: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-sand-100 mb-1">Six Degrees</h1>
      <p className="text-court-400 mb-8 text-sm">
        Trace the shortest chain of wins connecting any player to Miles Partain
      </p>

      <div className="card p-6 mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sand-400 text-xs uppercase tracking-wider mb-2">
              Starting Player
            </label>
            <PlayerSearch
              onSelect={findChain}
              placeholder="Search player..."
              initialSlug={params.get("player") ?? undefined}
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => player && findChain(player)}
              disabled={!player || loading}
              className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading ? "Searching..." : "Find Chain"}
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="card p-12 text-center">
          <div className="inline-flex items-center gap-3 text-gold-400">
            <div className="w-5 h-5 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
            <span>Tracing the chain...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="card p-6 text-red-400 text-sm border-red-900/50">
          {error}
        </div>
      )}

      {result && !loading && (
        <ChainVisualization key={chainKey} result={result} />
      )}

      {searched && !loading && !error && !result && (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-4">🏐</div>
          <div className="text-sand-300 font-medium mb-2">No chain found</div>
          <p className="text-court-400 text-sm">
            No win path could be traced to Miles Partain.<br />
            Try more tournament data or a different target pro.
          </p>
        </div>
      )}

      {!player && !loading && !searched && (
        <div className="card p-10 text-center text-court-400">
          Search for a player above to find their chain.
        </div>
      )}
    </div>
  );
}
