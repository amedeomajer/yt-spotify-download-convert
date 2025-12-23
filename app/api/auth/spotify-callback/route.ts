import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { exchangeSpotifyCode } from '@/lib/auth/spotify';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    console.error('Spotify error:', error);
    return NextResponse.json({ error: `Spotify authorization failed: ${error}` }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: 'No authorization code' }, { status: 400 });
  }

  try {
    const session = await getSession();

    // Verify state to prevent CSRF attacks
    if (state !== session.spotifyState) {
      console.error('State mismatch:', { received: state, expected: session.spotifyState });
      return NextResponse.json({ error: 'State mismatch - possible CSRF attack' }, { status: 400 });
    }

    const redirectUri = process.env.SPOTIFY_REDIRECT_URI!;
    const tokens = await exchangeSpotifyCode(code, redirectUri);

    // Store tokens in session
    session.spotifyToken = tokens;
    delete session.spotifyState;
    await session.save();

    // Redirect to callback page (which will close popup)
    return NextResponse.redirect(new URL('/auth/spotify-callback', request.url));
  } catch (error: any) {
    console.error('Spotify callback error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
