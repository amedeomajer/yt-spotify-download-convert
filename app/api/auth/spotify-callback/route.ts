import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { exchangeSpotifyCode } from '@/lib/auth/spotify';

export async function GET(request: NextRequest) {
  console.log('[SPOTIFY AUTH] Spotify callback started');
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  console.log('[SPOTIFY AUTH] Params received:', {
    hasCode: !!code,
    hasState: !!state,
    hasError: !!error
  });

  if (error) {
    console.error('[SPOTIFY AUTH] ERROR from Spotify:', error);
    return NextResponse.json({ error: `Spotify authorization failed: ${error}` }, { status: 400 });
  }

  if (!code) {
    console.error('[SPOTIFY AUTH] ERROR: No authorization code');
    return NextResponse.json({ error: 'No authorization code' }, { status: 400 });
  }

  try {
    console.log('[SPOTIFY AUTH] Getting session...');
    const session = await getSession();

    // Verify state to prevent CSRF attacks
    console.log('[SPOTIFY AUTH] Verifying state...');
    if (state !== session.spotifyState) {
      console.error('[SPOTIFY AUTH] ERROR: State mismatch:', { received: state, expected: session.spotifyState });
      return NextResponse.json({ error: 'State mismatch - possible CSRF attack' }, { status: 400 });
    }
    console.log('[SPOTIFY AUTH] State verified');

    console.log('[SPOTIFY AUTH] Exchanging code for tokens...');
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI!;
    const tokens = await exchangeSpotifyCode(code, redirectUri);
    console.log('[SPOTIFY AUTH] Tokens received:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expires_in
    });

    // Store tokens in session
    console.log('[SPOTIFY AUTH] Storing tokens in session...');
    session.spotifyToken = tokens;
    delete session.spotifyState;

    console.log('[SPOTIFY AUTH] Saving session...');
    await session.save();
    console.log('[SPOTIFY AUTH] Session saved successfully');

    // Redirect to callback page (which will close popup)
    console.log('[SPOTIFY AUTH] Redirecting to callback page');
    return NextResponse.redirect(new URL('/auth/spotify-callback', request.url));
  } catch (error: any) {
    console.error('[SPOTIFY AUTH] ERROR:', error);
    console.error('[SPOTIFY AUTH] Error message:', error.message);
    console.error('[SPOTIFY AUTH] Error stack:', error.stack);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
