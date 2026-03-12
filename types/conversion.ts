import { SpotifyTrack } from '@/lib/conversion/spotify-search';

export interface ConversionRequest {
  playlistId: string;
  playlistTitle: string;
  useAI?: boolean;
}

export interface MatchedSong {
  youtubeTitle: string;
  youtubeArtist: string;
  spotifyTrack: SpotifyTrack;
  confidence: number;
  matchTier: 1 | 2 | 3;
}

export interface LowConfidenceSong {
  youtubeTitle: string;
  youtubeArtist: string;
  spotifyTrack: SpotifyTrack;
  confidence: number;
  alternatives: SpotifyTrack[];
}

export interface NotFoundSong {
  youtubeTitle: string;
  youtubeArtist: string;
  videoId: string;
  reason: string;
  alternatives: SpotifyTrack[];
}

export interface ConversionStats {
  total: number;
  matched: number;
  lowConfidence: number;
  notFound: number;
}

export interface ConversionResponse {
  success: boolean;
  spotifyPlaylistUrl?: string;
  spotifyPlaylistId?: string;
  stats: ConversionStats;
  results: MatchedSong[];
  lowConfidence: LowConfidenceSong[];
  notFound: NotFoundSong[];
  error?: string;
}
