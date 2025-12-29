import { ParsedTitle } from './title-parser';
import { calculateSimilarity } from './string-similarity';

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: { name: string };
  uri: string;
  duration_ms: number;
  external_urls: { spotify: string };
}

export interface SearchResult {
  track: SpotifyTrack | null;
  confidence: number;
  matchTier: 1 | 2 | 3;
  reason: string;
  alternatives: SpotifyTrack[];
}

export async function searchSpotify(
  parsed: ParsedTitle,
  youtubeChannelName: string,
  accessToken: string
): Promise<SearchResult> {
  const allAlternatives: SpotifyTrack[] = [];

  // Strategy 1: Exact search (if we have artist)
  if (parsed.artist) {
    const exactResult = await exactSearch(parsed, accessToken);
    allAlternatives.push(...exactResult.alternatives);
    if (exactResult.confidence >= 0.75) {
      return { ...exactResult, alternatives: deduplicateTracks(allAlternatives) };
    }
  }

  // Strategy 2: Combined search with channel name as fallback
  const combinedResult = await combinedSearch(parsed, youtubeChannelName, accessToken);
  allAlternatives.push(...combinedResult.alternatives);
  if (combinedResult.confidence >= 0.65) {
    return { ...combinedResult, alternatives: deduplicateTracks(allAlternatives) };
  }

  // Strategy 3: Title-only fallback
  const titleOnlyResult = await titleOnlySearch(parsed, accessToken);
  allAlternatives.push(...titleOnlyResult.alternatives);
  if (titleOnlyResult.confidence >= 0.60) {
    return { ...titleOnlyResult, alternatives: deduplicateTracks(allAlternatives) };
  }

  return {
    track: null,
    confidence: 0,
    matchTier: 3,
    reason: 'No confident match found',
    alternatives: deduplicateTracks(allAlternatives)
  };
}

// Helper to remove duplicate tracks by ID
function deduplicateTracks(tracks: SpotifyTrack[]): SpotifyTrack[] {
  const seen = new Set<string>();
  return tracks.filter(track => {
    if (seen.has(track.id)) return false;
    seen.add(track.id);
    return true;
  }).slice(0, 5); // Return top 5 unique tracks
}

async function exactSearch(parsed: ParsedTitle, token: string): Promise<SearchResult> {
  const query = `artist:"${parsed.artist}" track:"${parsed.title}"`;

  try {
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      return { track: null, confidence: 0, matchTier: 1, reason: 'API error', alternatives: [] };
    }

    const data = await response.json();
    const tracks = data.tracks?.items || [];

    if (tracks.length === 0) {
      return { track: null, confidence: 0, matchTier: 1, reason: 'No results', alternatives: [] };
    }

    // Calculate confidence for top result
    const topTrack = tracks[0];
    const artistMatch = calculateSimilarity(
      parsed.artist!.toLowerCase(),
      topTrack.artists[0].name.toLowerCase()
    );
    const titleMatch = calculateSimilarity(
      parsed.title.toLowerCase(),
      topTrack.name.toLowerCase()
    );

    // IMPORTANT: Require BOTH artist AND title to match well
    const confidence = Math.min(artistMatch, titleMatch);

    return {
      track: confidence >= 0.75 ? topTrack : null,
      confidence,
      matchTier: 1,
      reason: `Artist: ${(artistMatch * 100).toFixed(0)}%, Title: ${(titleMatch * 100).toFixed(0)}%`,
      alternatives: tracks
    };
  } catch (error) {
    return { track: null, confidence: 0, matchTier: 1, reason: 'Search failed', alternatives: [] };
  }
}

async function combinedSearch(
  parsed: ParsedTitle,
  channelName: string,
  token: string
): Promise<SearchResult> {
  // Use parsed artist if available, otherwise try channel name (cleaned)
  const artistName = parsed.artist || cleanChannelName(channelName);
  const query = `${artistName} ${parsed.title}`;

  try {
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      return { track: null, confidence: 0, matchTier: 2, reason: 'API error', alternatives: [] };
    }

    const data = await response.json();
    const tracks = data.tracks?.items || [];

    if (tracks.length === 0) {
      return { track: null, confidence: 0, matchTier: 2, reason: 'No results', alternatives: [] };
    }

    // Find best match from results (AND logic - both artist and title must match)
    let bestMatch: SpotifyTrack | null = null;
    let bestConfidence = 0;

    for (const track of tracks) {
      const titleMatch = calculateSimilarity(
        parsed.title.toLowerCase(),
        track.name.toLowerCase()
      );
      const artistMatch = calculateSimilarity(
        artistName.toLowerCase(),
        track.artists[0].name.toLowerCase()
      );

      // Use AND logic: BOTH must match reasonably well
      const confidence = Math.min(artistMatch, titleMatch);

      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestMatch = track;
      }
    }

    return {
      track: bestConfidence >= 0.65 ? bestMatch : null,
      confidence: bestConfidence,
      matchTier: 2,
      reason: `Combined search: ${(bestConfidence * 100).toFixed(0)}% match`,
      alternatives: tracks
    };
  } catch (error) {
    return { track: null, confidence: 0, matchTier: 2, reason: 'Search failed', alternatives: [] };
  }
}

async function titleOnlySearch(parsed: ParsedTitle, token: string): Promise<SearchResult> {
  const query = parsed.title;

  try {
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      return { track: null, confidence: 0, matchTier: 3, reason: 'API error', alternatives: [] };
    }

    const data = await response.json();
    const tracks = data.tracks?.items || [];

    if (tracks.length === 0) {
      return { track: null, confidence: 0, matchTier: 3, reason: 'No results', alternatives: [] };
    }

    // Find best title match
    let bestMatch: SpotifyTrack | null = null;
    let bestConfidence = 0;

    for (const track of tracks) {
      const titleMatch = calculateSimilarity(
        parsed.title.toLowerCase(),
        track.name.toLowerCase()
      );

      if (titleMatch > bestConfidence) {
        bestConfidence = titleMatch;
        bestMatch = track;
      }
    }

    return {
      track: bestConfidence >= 0.60 ? bestMatch : null,
      confidence: bestConfidence,
      matchTier: 3,
      reason: `Title-only: ${(bestConfidence * 100).toFixed(0)}% match`,
      alternatives: tracks
    };
  } catch (error) {
    return { track: null, confidence: 0, matchTier: 3, reason: 'Search failed', alternatives: [] };
  }
}

// Clean up YouTube channel names (remove "- Topic", "Vevo", etc.)
function cleanChannelName(channelName: string): string {
  return channelName
    .replace(/ - Topic$/i, '')
    .replace(/VEVO$/i, '')
    .replace(/Official$/i, '')
    .trim();
}
