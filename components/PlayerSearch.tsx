"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Player } from "@/types";

interface Props {
  onSelect: (player: Player) => void;
  placeholder?: string;
  initialSlug?: string;
}

export default function PlayerSearch({
  onSelect,
  placeholder = "Search players...",
  initialSlug,
}: Props) {
  const [query, setQuery] = useState(initialSlug ?? "");
  const [results, setResults] = useState<Player[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.players ?? []);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(player: Player) {
    setQuery(player.name);
    setOpen(false);
    onSelect(player);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="input-field pr-10"
        />
        {loading ? (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-court-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-1.5 bg-court-800 border border-court-600 rounded-xl overflow-hidden shadow-xl animate-fade-in">
          {results.map((player) => (
            <li key={player.id}>
              <button
                type="button"
                onMouseDown={() => handleSelect(player)}
                className="w-full text-left px-4 py-3 hover:bg-court-700 transition-colors flex items-center gap-3"
              >
                <div className="w-7 h-7 rounded-full bg-court-600 flex items-center justify-center text-xs text-sand-400 font-medium shrink-0">
                  {player.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sand-100 text-sm font-medium">
                    {player.name}
                  </div>
                  {player.avp_rank && (
                    <div className="text-court-400 text-xs">
                      AVP Rank #{player.avp_rank}
                    </div>
                  )}
                </div>
                {player.is_pro && (
                  <span className="ml-auto text-xs text-gold-400 font-medium">
                    PRO
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && results.length === 0 && query.length >= 2 && (
        <div className="absolute z-50 w-full mt-1.5 bg-court-800 border border-court-600 rounded-xl px-4 py-3 text-court-400 text-sm">
          No players found
        </div>
      )}
    </div>
  );
}
