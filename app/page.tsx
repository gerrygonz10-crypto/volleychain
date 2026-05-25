"use client";

import { useState } from "react";
import Link from "next/link";
import PlayerSearch from "@/components/PlayerSearch";
import type { Player } from "@/types";

export default function Home() {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  return (
    <div className="min-h-screen bg-court-900 flex flex-col">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-4 pt-24 pb-16 text-center">
        <div className="mb-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-court-700 border border-court-600 text-sand-400 text-xs font-medium uppercase tracking-widest">
          Beach Volleyball Intelligence
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-sand-100 mb-4">
          Volley
          <span className="text-gold-400">Chain</span>
        </h1>

        <p className="text-court-400 text-lg md:text-xl max-w-xl mb-10 leading-relaxed">
          Track your match record against every opponent.
          <br />
          Trace your chain to the top AVP pros.
        </p>

        {/* Player search */}
        <div className="w-full max-w-md mb-8">
          <PlayerSearch
            onSelect={setSelectedPlayer}
            placeholder="Search a player to get started..."
          />
        </div>

        {selectedPlayer && (
          <div className="flex gap-3 animate-fade-in">
            <Link
              href={`/dashboard?player=${selectedPlayer.slug}`}
              className="btn-primary"
            >
              View Dashboard
            </Link>
            <Link
              href={`/six-degrees?player=${selectedPlayer.slug}`}
              className="btn-ghost"
            >
              Six Degrees
            </Link>
          </div>
        )}
      </section>

      {/* Feature cards */}
      <section className="max-w-4xl mx-auto px-4 pb-24 grid md:grid-cols-2 gap-6 w-full">
        <Link href="/dashboard" className="card p-6 hover:border-sand-500/50 transition-colors group">
          <div className="text-3xl mb-3">🏆</div>
          <h2 className="text-xl font-semibold text-sand-100 mb-2 group-hover:text-gold-400 transition-colors">
            Match Dashboard
          </h2>
          <p className="text-court-400 text-sm leading-relaxed">
            Win/loss records against every opponent you've faced in tournament
            play, pulled live from volleyballlife.com. Expandable match history
            with scores and tournament info.
          </p>
        </Link>

        <Link href="/six-degrees" className="card p-6 hover:border-sand-500/50 transition-colors group">
          <div className="text-3xl mb-3">🔗</div>
          <h2 className="text-xl font-semibold text-sand-100 mb-2 group-hover:text-gold-400 transition-colors">
            Six Degrees
          </h2>
          <p className="text-court-400 text-sm leading-relaxed">
            Find the shortest chain of wins connecting any player to a top AVP
            pro. Animated visualization shows each link in the chain with match
            details.
          </p>
        </Link>
      </section>
    </div>
  );
}
