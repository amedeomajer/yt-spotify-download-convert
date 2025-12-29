import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

export async function POST(request: Request) {
  try {
    const { playlistId, trackUri } = await request.json();

    if (!playlistId || !trackUri) {
      return NextResponse.json(
        { success: false, error: 'Missing playlistId or trackUri' },
        { status: 400 }
      );
    }

    // Get session
    const session = await getSession();
    if (!session.spotifyToken) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated with Spotify' },
        { status: 401 }
      );
    }

    // Add track to playlist
    const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.spotifyToken.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uris: [trackUri] })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to add track to playlist:', response.status, errorText);
      return NextResponse.json(
        { success: false, error: `Failed to add track: ${response.status}` },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error adding track:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to add track' },
      { status: 500 }
    );
  }
}
