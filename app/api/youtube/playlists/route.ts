import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSession } from '@/lib/auth/session';
import { createYouTubeOAuthClient } from '@/lib/auth/youtube';

export async function GET() {
  try {
    // Get session and check auth
    const session = await getSession();
    if (!session.youtubeToken) {
      return NextResponse.json(
        { error: 'Not authenticated with YouTube' },
        { status: 401 }
      );
    }

    // Create authenticated YouTube client
    const oAuth2Client = await createYouTubeOAuthClient();
    oAuth2Client.setCredentials(session.youtubeToken);
    const youtube = google.youtube({ version: 'v3', auth: oAuth2Client });

    // Fetch user's playlists
    const response = await youtube.playlists.list({
      part: ['snippet', 'contentDetails'],
      mine: true,
      maxResults: 50,
    });

    // Transform to simpler format
    const playlists = response.data.items?.map(playlist => ({
      id: playlist.id,
      title: playlist.snippet?.title,
      description: playlist.snippet?.description,
      thumbnail: playlist.snippet?.thumbnails?.medium?.url,
      itemCount: playlist.contentDetails?.itemCount,
      channelTitle: playlist.snippet?.channelTitle,
    })) || [];

    return NextResponse.json({ playlists });
  } catch (error: any) {
    console.error('Error fetching YouTube playlists:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch playlists' },
      { status: 500 }
    );
  }
}
