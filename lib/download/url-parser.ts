/**
 * Parse YouTube URLs to extract video or playlist IDs
 */

export interface ParsedYouTubeUrl {
  type: 'video' | 'playlist';
  id: string;
  url: string;
}

/**
 * Parse a YouTube URL and extract the video or playlist ID
 * Supports multiple URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://youtube.com/watch?v=VIDEO_ID
 * - https://www.youtube.com/playlist?list=PLAYLIST_ID
 * - https://youtube.com/playlist?list=PLAYLIST_ID
 */
export function parseYouTubeUrl(urlString: string): ParsedYouTubeUrl | null {
  try {
    // Handle URLs without protocol
    if (!urlString.startsWith('http')) {
      urlString = 'https://' + urlString;
    }

    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    // Check if it's a YouTube domain
    if (!hostname.includes('youtube.com') && !hostname.includes('youtu.be')) {
      return null;
    }

    // Check for playlist URL
    const playlistId = url.searchParams.get('list');
    if (playlistId) {
      return {
        type: 'playlist',
        id: playlistId,
        url: urlString,
      };
    }

    // Check for video ID in different formats
    let videoId: string | null = null;

    if (hostname.includes('youtu.be')) {
      // Short URL format: https://youtu.be/VIDEO_ID
      videoId = url.pathname.slice(1).split('?')[0];
    } else if (url.pathname === '/watch') {
      // Standard format: https://www.youtube.com/watch?v=VIDEO_ID
      videoId = url.searchParams.get('v');
    } else if (url.pathname.startsWith('/embed/')) {
      // Embed format: https://www.youtube.com/embed/VIDEO_ID
      videoId = url.pathname.split('/embed/')[1].split('?')[0];
    } else if (url.pathname.startsWith('/v/')) {
      // Old format: https://www.youtube.com/v/VIDEO_ID
      videoId = url.pathname.split('/v/')[1].split('?')[0];
    }

    if (videoId && isValidYouTubeVideoId(videoId)) {
      return {
        type: 'video',
        id: videoId,
        url: urlString,
      };
    }

    return null;
  } catch (error) {
    console.error('[URL Parser] Failed to parse URL:', error);
    return null;
  }
}

/**
 * Validate YouTube video ID format
 * Video IDs are typically 11 characters: alphanumeric, hyphens, and underscores
 */
export function isValidYouTubeVideoId(videoId: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}

/**
 * Validate YouTube playlist ID format
 * Playlist IDs start with PL, UU, etc. and are typically 32-34 characters
 */
export function isValidYouTubePlaylistId(playlistId: string): boolean {
  return /^[A-Z]{2}[a-zA-Z0-9_-]{10,}$/.test(playlistId);
}

/**
 * Get a user-friendly description of what was parsed
 */
export function getUrlDescription(parsed: ParsedYouTubeUrl): string {
  if (parsed.type === 'video') {
    return `Video ID: ${parsed.id}`;
  } else {
    return `Playlist ID: ${parsed.id}`;
  }
}
