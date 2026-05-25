"use client";

import { useState } from "react";
import type { HeadToHeadRecord } from "@/types";
import clsx from "clsx";

interface Props {
  record: HeadToHeadRecord;
}

export default function HeadToHeadCard({ record }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { opponent, wins, losses, matches } = record;
  const total = wins + losses;
  const winPct = total > 0 ? Math.round((wins / total) * 100) : 0;
  const isWinning = wins > losses;
  const isSplit = wins === losses;

  return (
    <div className="card overflow-hidden animate-slide-up">
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 p-4 hover:bg-court-700/40 transition-colors text-left"
      >
        {/* Avatar */}
        <div
          className={clsx(
            "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
            isWinning
              ? "bg-emerald-900/50 text-emerald-400"
              : isSplit
              ? "bg-court-600 text-sand-400"
              : "bg-red-900/50 text-red-400"
          )}
        >
          {opponent.name.charAt(0).toUpperCase()}
        </div>

        {/* Name + record */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sand-100 font-medium truncate">
              {opponent.name}
            </span>
            {opponent.is_pro && (
              <span className="text-xs text-gold-400 font-medium shrink-0">
                PRO
              </span>
            )}
          </div>
          <div className="text-court-400 text-xs mt-0.5">
            {total} match{total !== 1 ? "es" : ""}
          </div>
        </div>

        {/* Win/Loss badges */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="badge-win">{wins}W</span>
          <span className="badge-loss">{losses}L</span>
        </div>

        {/* Win bar */}
        <div className="hidden md:block w-24 shrink-0">
          <div className="w-full h-1.5 bg-court-600 rounded-full overflow-hidden">
            <div
              className={clsx(
                "h-full rounded-full transition-all duration-500",
                isWinning
                  ? "bg-emerald-500"
                  : isSplit
                  ? "bg-sand-500"
                  : "bg-red-500"
              )}
              style={{ width: `${winPct}%` }}
            />
          </div>
          <div className="text-center text-xs text-court-500 mt-0.5">
            {winPct}%
          </div>
        </div>

        {/* Chevron */}
        <svg
          className={clsx(
            "w-4 h-4 text-court-500 transition-transform shrink-0",
            expanded && "rotate-180"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Expanded match history */}
      {expanded && (
        <div className="border-t border-court-700 animate-fade-in">
          {matches.map((match) => {
            const won = match.winner_id !== opponent.id;
            return (
              <div
                key={match.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-court-700/50 last:border-0 hover:bg-court-800/50"
              >
                <span
                  className={clsx(
                    "w-6 text-xs font-bold uppercase",
                    won ? "text-emerald-400" : "text-red-400"
                  )}
                >
                  {won ? "W" : "L"}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="text-sand-200 text-sm truncate">
                    {match.tournament_name}
                  </div>
                  <div className="text-court-400 text-xs mt-0.5">
                    {match.round} &middot;{" "}
                    {match.tournament_date
                      ? new Date(match.tournament_date).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" }
                        )
                      : "—"}
                  </div>
                </div>

                {match.score && (
                  <div className="text-sand-300 text-sm font-mono shrink-0">
                    {match.score}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
