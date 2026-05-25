"use client";

import { useEffect, useState } from "react";
import type { ChainResult } from "@/types";
import clsx from "clsx";

interface Props {
  result: ChainResult;
}

export default function ChainVisualization({ result }: Props) {
  const [visibleLinks, setVisibleLinks] = useState(0);
  const { chain, degrees, player, target } = result;

  // Animate links one by one — state resets via key prop remount on new result
  useEffect(() => {
    const total = chain.length + 1; // +1 for final target node
    const interval = setInterval(() => {
      setVisibleLinks((v) => {
        if (v >= total) {
          clearInterval(interval);
          return v;
        }
        return v + 1;
      });
    }, 380);
    return () => clearInterval(interval);
  }, [chain.length]);

  if (degrees === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="text-4xl mb-3">🏆</div>
        <div className="text-sand-100 font-semibold text-lg">
          {player.name} IS the target pro!
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6 animate-fade-in">
      {/* Summary */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-sand-100 font-semibold text-lg">Chain found!</div>
          <div className="text-court-400 text-sm">
            {player.name} is{" "}
            <span className="text-gold-400 font-semibold">{degrees}</span>{" "}
            degree{degrees !== 1 ? "s" : ""} from {target.name}
          </div>
        </div>
        <div className="text-center">
          <div className="text-4xl font-bold text-gold-400">{degrees}</div>
          <div className="text-court-400 text-xs uppercase tracking-wider">
            Degree{degrees !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Chain nodes */}
      <div className="flex flex-col gap-0">
        {/* Starting player */}
        {visibleLinks >= 1 && (
          <PlayerNode
            name={player.name}
            label="Starting player"
            isFirst
            delay={0}
          />
        )}

        {chain.map((link, i) => (
          <div key={i}>
            {/* Arrow + match info */}
            {visibleLinks > i + 1 && (
              <MatchConnector match={link.match} delay={(i + 1) * 80} />
            )}

            {/* Next player (loser) */}
            {visibleLinks > i + 1 && (
              <PlayerNode
                name={link.loser.name}
                label={
                  i === chain.length - 1
                    ? `${target.is_pro ? "AVP Pro" : "Target"}`
                    : `${i + 1} degree${i + 1 !== 1 ? "s" : ""} away`
                }
                isLast={i === chain.length - 1}
                isPro={link.loser.is_pro || i === chain.length - 1}
                delay={(i + 1) * 80}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayerNode({
  name,
  label,
  isFirst,
  isLast,
  isPro,
  delay,
}: {
  name: string;
  label?: string;
  isFirst?: boolean;
  isLast?: boolean;
  isPro?: boolean;
  delay: number;
}) {
  return (
    <div
      className="flex items-center gap-3 animate-slide-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      <div
        className={clsx(
          "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0",
          isFirst
            ? "bg-gold-500/20 border-2 border-gold-500 text-gold-400"
            : isLast || isPro
            ? "bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400"
            : "bg-court-600 border border-court-500 text-sand-300"
        )}
      >
        {name.charAt(0).toUpperCase()}
      </div>
      <div>
        <div
          className={clsx(
            "font-semibold",
            isFirst
              ? "text-gold-300"
              : isLast || isPro
              ? "text-emerald-300"
              : "text-sand-100"
          )}
        >
          {name}
        </div>
        {label && <div className="text-court-400 text-xs">{label}</div>}
      </div>
      {(isLast || isPro) && (
        <span className="ml-auto text-xs text-gold-400 border border-gold-700 px-2 py-0.5 rounded-full">
          AVP PRO
        </span>
      )}
    </div>
  );
}

function MatchConnector({
  match,
  delay,
}: {
  match: { tournament_name: string; tournament_date: string; score: string; round: string };
  delay: number;
}) {
  return (
    <div
      className="flex items-stretch gap-3 my-1 animate-fade-in"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      {/* Vertical line */}
      <div className="w-10 flex justify-center shrink-0">
        <div className="w-0.5 bg-gradient-to-b from-gold-600/60 to-gold-600/20 my-1" />
      </div>

      {/* Match info pill */}
      <div className="flex-1 bg-court-700/50 border border-court-600/50 rounded-lg px-3 py-2 my-1">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sand-300 text-xs font-medium truncate">
              {match.tournament_name || "Tournament"}
            </div>
            <div className="text-court-400 text-xs">
              {match.round}
              {match.tournament_date && (
                <>
                  {" · "}
                  {new Date(match.tournament_date).toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })}
                </>
              )}
            </div>
          </div>
          {match.score && (
            <div className="text-gold-400 text-xs font-mono shrink-0">
              {match.score}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
