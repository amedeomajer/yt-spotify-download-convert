import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSession } from '@/lib/auth/session';
import { createYouTubeOAuthClient } from '@/lib/auth/youtube';
import { parseYouTubeTitle } from '@/lib/conversion/title-parser';
import { parseWithAI } from '@/lib/conversion/ai-title-parser';
import { searchSpotify } from '@/lib/conversion/spotify-search';
import type {
  ConversionRequest,
  ConversionResponse,
  MatchedSong,
  LowConfidenceSong,
  NotFoundSong,
} from '@/types/conversion';

export async function POST(request: Request) {
  try {
    const { playlistId, playlistTitle }: ConversionRequest = await request.json();

    // 1. Get session tokens
    const session = await getSession();
    if (!session.youtubeToken || !session.spotifyToken) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated', stats: { total: 0, matched: 0, lowConfidence: 0, notFound: 0 }, results: [], lowConfidence: [], notFound: [] } as ConversionResponse,
        { status: 401 }
      );
    }

    // 2. Fetch YouTube playlist items
    const oAuth2Client = await createYouTubeOAuthClient();
    oAuth2Client.setCredentials(session.youtubeToken);
    const youtube = google.youtube({ version: 'v3', auth: oAuth2Client });

    console.log(`Fetching playlist items for: ${playlistId}`);
    const playlistItems = await fetchAllPlaylistItems(youtube, playlistId);
    console.log(`Found ${playlistItems.length} items in playlist`);

    // 3. Process each video
    const results: MatchedSong[] = [];
    const notFound: NotFoundSong[] = [];
    const lowConfidence: LowConfidenceSong[] = [];

    for (let i = 0; i < playlistItems.length; i++) {
      const item = playlistItems[i];
      const videoTitle = item.snippet.title;
      const channelName = item.snippet.videoOwnerChannelTitle || item.snippet.channelTitle;

      console.log(`[${i + 1}/${playlistItems.length}] Processing: ${videoTitle}`);

      // Skip deleted/private videos
      if (videoTitle === 'Deleted video' || videoTitle === 'Private video') {
        notFound.push({
          youtubeTitle: videoTitle,
          youtubeArtist: channelName,
          reason: 'Video unavailable'
        });
        continue;
      }

      // Parse title with rule-based parser
      let parsed = parseYouTubeTitle(videoTitle);
      console.log(`  Parsed: artist="${parsed.artist || 'N/A'}", title="${parsed.title}"`);

      // If no artist found, try AI parsing
      if (!parsed.artist && process.env.OPENAI_API_KEY) {
        console.log(`  No artist found, trying AI parsing...`);
        try {
          const aiParsed = await parseWithAI(videoTitle);
          if (aiParsed.artist) {
            console.log(`  AI parsed: artist="${aiParsed.artist}", title="${aiParsed.title}"`);
            parsed = aiParsed;
          }
        } catch (error) {
          console.error(`  AI parsing failed:`, error);
        }
      }

      // Search Spotify
      const searchResult = await searchSpotify(
        parsed,
        channelName,
        session.spotifyToken.access_token
      );

      // If the YouTube video has a version indicator (Remix, Live, etc.),
      // check if the Spotify result also has that indicator
      let adjustedConfidence = searchResult.confidence;
      if (parsed.version && searchResult.track) {
        const spotifyTrackName = searchResult.track.name.toLowerCase();

        // Check if the Spotify track name contains any version keyword
        const hasVersionKeyword =
          spotifyTrackName.includes('remix') ||
          spotifyTrackName.includes('live') ||
          spotifyTrackName.includes('acoustic') ||
          spotifyTrackName.includes('remaster');

        if (!hasVersionKeyword) {
          // Version mismatch: likely found the original when searching for a version
          adjustedConfidence = Math.max(0, searchResult.confidence - 0.30);
          console.log(`  Version mismatch: YouTube has "${parsed.version}" but Spotify doesn't. Confidence: ${(searchResult.confidence * 100).toFixed(0)}% → ${(adjustedConfidence * 100).toFixed(0)}%`);
        } else {
          console.log(`  Version match: Both have version indicator. Keeping confidence: ${(searchResult.confidence * 100).toFixed(0)}%`);
        }
      } else if (parsed.version && !searchResult.track) {
        console.log(`  Version detected (${parsed.version}) but no match found`);
      }

      console.log(`  Result: confidence=${(adjustedConfidence * 100).toFixed(0)}%, tier=${searchResult.matchTier}`);

      // Categorize result using adjusted confidence
      if (searchResult.track && adjustedConfidence >= 0.75) {
        results.push({
          youtubeTitle: videoTitle,
          youtubeArtist: parsed.artist || channelName,
          spotifyTrack: searchResult.track,
          confidence: adjustedConfidence,
          matchTier: searchResult.matchTier
        });
      } else if (searchResult.track && adjustedConfidence >= 0.60) {
        lowConfidence.push({
          youtubeTitle: videoTitle,
          youtubeArtist: parsed.artist || channelName,
          spotifyTrack: searchResult.track,
          confidence: adjustedConfidence,
          alternatives: searchResult.alternatives
        });
      } else {
        notFound.push({
          youtubeTitle: videoTitle,
          youtubeArtist: parsed.artist || channelName,
          reason: searchResult.reason,
          alternatives: searchResult.alternatives
        });
      }

      // Rate limiting (Spotify allows 30 requests/sec, we'll do ~10/sec)
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 4. Create Spotify playlist
    console.log(`Creating Spotify playlist: ${playlistTitle}`);
    const spotifyPlaylist = await createSpotifyPlaylist(
      playlistTitle,
      session.spotifyToken.access_token
    );

    // 5. Add tracks to Spotify playlist (both high confidence and low confidence)
    const highConfidenceUris = results.map(r => r.spotifyTrack.uri);
    const lowConfidenceUris = lowConfidence.map(r => r.spotifyTrack.uri);
    const allTrackUris = [...highConfidenceUris, ...lowConfidenceUris];

    if (allTrackUris.length > 0) {
      console.log(`Adding ${allTrackUris.length} tracks to playlist (${highConfidenceUris.length} high conf, ${lowConfidenceUris.length} low conf)`);
      await addTracksToPlaylist(
        spotifyPlaylist.id,
        allTrackUris,
        session.spotifyToken.access_token
      );
    }

    // 6. Return results
    const response: ConversionResponse = {
      success: true,
      spotifyPlaylistUrl: spotifyPlaylist.external_urls.spotify,
      spotifyPlaylistId: spotifyPlaylist.id,
      stats: {
        total: playlistItems.length,
        matched: results.length,
        lowConfidence: lowConfidence.length,
        notFound: notFound.length
      },
      results,
      lowConfidence,
      notFound
    };

    console.log(`Conversion complete: ${results.length}/${playlistItems.length} matched`);
    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Conversion error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Conversion failed',
        stats: { total: 0, matched: 0, lowConfidence: 0, notFound: 0 },
        results: [],
        lowConfidence: [],
        notFound: []
      } as ConversionResponse,
      { status: 500 }
    );
  }
}

async function fetchAllPlaylistItems(youtube: any, playlistId: string) {
  const items = [];
  let pageToken: string | undefined = undefined;

  do {
    const response = await youtube.playlistItems.list({
      part: ['snippet', 'contentDetails'],
      playlistId,
      maxResults: 50,
      pageToken
    });

    items.push(...(response.data.items || []));
    pageToken = response.data.nextPageToken;
  } while (pageToken);

  return items;
}

async function createSpotifyPlaylist(name: string, token: string) {
  // Get user ID first
  const userRes = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!userRes.ok) {
    const errorText = await userRes.text();
    console.error('Spotify user info error:', userRes.status, errorText);
    throw new Error(`Failed to get Spotify user info: ${userRes.status} ${errorText}`);
  }

  const user = await userRes.json();

  // Create playlist
  const playlistRes = await fetch(`https://api.spotify.com/v1/users/${user.id}/playlists`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      description: 'Converted from YouTube playlist',
      public: false
    })
  });

  if (!playlistRes.ok) {
    throw new Error('Failed to create Spotify playlist');
  }

  return playlistRes.json();
}

async function addTracksToPlaylist(playlistId: string, uris: string[], token: string) {
  // Spotify allows max 100 tracks per request
  for (let i = 0; i < uris.length; i += 100) {
    const batch = uris.slice(i, i + 100);
    const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uris: batch })
    });

    if (!response.ok) {
      throw new Error('Failed to add tracks to playlist');
    }

    // Rate limiting between batches
    if (i + 100 < uris.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}
