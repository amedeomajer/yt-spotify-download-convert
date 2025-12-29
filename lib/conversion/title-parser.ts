export interface ParsedTitle {
  artist: string | null;
  title: string;
  features: string[];
  version?: string;
}

export function parseYouTubeTitle(rawTitle: string): ParsedTitle {
  // 1. Remove common suffixes
  let cleaned = rawTitle
    .replace(/\(Official Video\)/gi, '')
    .replace(/\(Official Audio\)/gi, '')
    .replace(/\(Official Music Video\)/gi, '')
    .replace(/\[.*?Lyrics.*?\]/gi, '')
    .replace(/\(.*?Lyric.*?\)/gi, '')
    .replace(/\(.*?HD.*?\)/gi, '')
    .replace(/\[HD\]/gi, '')
    .replace(/\(.*?Audio.*?\)/gi, '')
    .replace(/\(.*?Video.*?\)/gi, '')
    .trim();

  // 2. Extract version info (before removing parentheses)
  // Match any parentheses containing Remix/Live/etc., not just those exact words
  const versionMatch = cleaned.match(/\(([^)]*(?:Remix|Live|Acoustic|Remaster|Remastered)[^)]*)\)/i);
  const version = versionMatch ? versionMatch[1] : undefined;

  // 3. Extract featured artists
  const featMatch = cleaned.match(/\((feat\.|ft\.|featuring) ([^)]+)\)/i);
  const features = featMatch ? [featMatch[2]] : [];

  // Remove feat/version from cleaned title
  if (featMatch) {
    cleaned = cleaned.replace(featMatch[0], '').trim();
  }
  if (versionMatch) {
    cleaned = cleaned.replace(versionMatch[0], '').trim();
  }

  // 4. Try "Artist - Title" format
  const dashMatch = cleaned.match(/^([^-]+) - (.+)$/);
  if (dashMatch) {
    return {
      artist: dashMatch[1].trim(),
      title: dashMatch[2].trim(),
      features,
      version
    };
  }

  // 5. Try "Title - Artist" format (less common)
  // Heuristic: if the part after dash is much shorter, it's likely the artist
  const reverseDashMatch = cleaned.match(/^(.+) - ([^-]+)$/);
  if (reverseDashMatch) {
    const firstPart = reverseDashMatch[1].trim();
    const secondPart = reverseDashMatch[2].trim();

    if (secondPart.length < firstPart.length / 2) {
      return {
        artist: secondPart,
        title: firstPart,
        features,
        version
      };
    }
  }

  // 6. Fallback: no artist found
  return {
    artist: null,
    title: cleaned,
    features,
    version
  };
}
