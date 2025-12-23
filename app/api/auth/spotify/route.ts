import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { loadSpotifyCredentials, generateSpotifyAuthUrl } from '@/lib/auth/spotify';

export async function GET() {
  try {
    const creds = await loadSpotifyCredentials();
    const { client_id } = creds;
    const redirect_uri = process.env.SPOTIFY_REDIRECT_URI!;
    const state = Math.random().toString(36).substring(7);

    // Store state in session for verification
    const session = await getSession();
    session.spotifyState = state;
    await session.save();

    const authUrl = generateSpotifyAuthUrl(client_id, redirect_uri, state);

    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error('Spotify OAuth error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
