export interface Player {
  id: string;
  name: string;
  slug: string; // volleyballlife.com profile slug
  avp_rank?: number;
  is_pro: boolean;
  created_at: string;
}

export interface Match {
  id: string;
  tournament_id: string;
  tournament_name: string;
  tournament_date: string;
  round: string;
  winner_id: string;
  loser_id: string;
  winner_name: string;
  loser_name: string;
  score: string; // e.g. "21-18, 21-15"
  created_at: string;
}

export interface HeadToHeadRecord {
  opponent: Player;
  wins: number;
  losses: number;
  matches: Match[];
}

export interface ChainLink {
  winner: Player;
  loser: Player;
  match: Match;
}

export interface ChainResult {
  player: Player;
  target: Player;
  chain: ChainLink[];
  degrees: number;
}

export interface SearchResult {
  players: Player[];
  query: string;
}
