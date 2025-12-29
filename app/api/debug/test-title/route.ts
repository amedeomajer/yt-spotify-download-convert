import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { parseYouTubeTitle } from '@/lib/conversion/title-parser';
import { parseWithAI } from '@/lib/conversion/ai-title-parser';
import { searchSpotify } from '@/lib/conversion/spotify-search';

export async function POST(request: Request) {
  try {
    const { youtubeTitle } = await request.json();

    if (!youtubeTitle) {
      return NextResponse.json({ error: 'Missing youtubeTitle' }, { status: 400 });
    }

    // Get session for Spotify token
    const session = await getSession();
    if (!session.spotifyToken) {
      return NextResponse.json(
        { error: 'Not authenticated with Spotify. Please connect Spotify first.' },
        { status: 401 }
      );
    }

    // Parse the title with rule-based parser
    let parsed = parseYouTubeTitle(youtubeTitle);
    let aiParsed = null;

    // If no artist found, try AI parsing
    if (!parsed.artist && process.env.OPENAI_API_KEY) {
      try {
        aiParsed = await parseWithAI(youtubeTitle);
        if (aiParsed.artist) {
          parsed = aiParsed;
        }
      } catch (error) {
        console.error('AI parsing failed:', error);
      }
    }

    // Search Spotify
    const searchResult = await searchSpotify(
      parsed,
      'Unknown Artist', // Fallback channel name
      session.spotifyToken.access_token
    );

    // Calculate adjusted confidence (same logic as conversion)
    let adjustedConfidence = searchResult.confidence;
    let adjustmentReason = '';

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
        adjustmentReason = `Version mismatch: YouTube has "${parsed.version}" but Spotify doesn't. Reduced by 30%.`;
      } else {
        adjustmentReason = 'Version match: Both have version indicator. Kept original confidence.';
      }
    } else if (parsed.version && !searchResult.track) {
      adjustmentReason = `Version detected (${parsed.version}) but no match found.`;
    }

    // Determine category
    let category = 'notFound';
    if (searchResult.track && adjustedConfidence >= 0.75) {
      category = 'matched';
    } else if (searchResult.track && adjustedConfidence >= 0.60) {
      category = 'lowConfidence';
    }

    return NextResponse.json({
      parsed,
      searchResult,
      adjustedConfidence,
      adjustmentReason,
      category
    });
  } catch (error: any) {
    console.error('Debug test error:', error);
    return NextResponse.json(
      { error: error.message || 'Test failed' },
      { status: 500 }
    );
  }
}
