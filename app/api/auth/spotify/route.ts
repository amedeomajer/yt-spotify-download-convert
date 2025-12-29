import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { loadSpotifyCredentials, generateSpotifyAuthUrl } from '@/lib/auth/spotify';

export async function GET() {
  console.log('[SPOTIFY AUTH] Starting Spotify OAuth flow...');
  try {
    console.log('[SPOTIFY AUTH] Loading credentials...');
    const creds = await loadSpotifyCredentials();
    const { client_id } = creds;
    const redirect_uri = process.env.SPOTIFY_REDIRECT_URI!;
    const state = Math.random().toString(36).substring(7);

    console.log('[SPOTIFY AUTH] Generated state:', state);
    console.log('[SPOTIFY AUTH] Redirect URI:', redirect_uri);

    // Store state in session for verification
    console.log('[SPOTIFY AUTH] Getting session...');
    const session = await getSession();
    session.spotifyState = state;

    console.log('[SPOTIFY AUTH] Saving state to session...');
    await session.save();
    console.log('[SPOTIFY AUTH] State saved successfully');

    console.log('[SPOTIFY AUTH] Generating auth URL...');
    const authUrl = generateSpotifyAuthUrl(client_id, redirect_uri, state);
    console.log('[SPOTIFY AUTH] Auth URL generated:', authUrl.substring(0, 50) + '...');

    console.log('[SPOTIFY AUTH] Redirecting to Spotify...');
    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error('[SPOTIFY AUTH] ERROR:', error);
    console.error('[SPOTIFY AUTH] Error stack:', error.stack);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
