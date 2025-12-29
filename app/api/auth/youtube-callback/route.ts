import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { createYouTubeOAuthClient } from '@/lib/auth/youtube';

export async function GET(request: NextRequest) {
  console.log('[YT AUTH] YouTube callback started');
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');

  console.log('[YT AUTH] Code received:', code ? 'YES' : 'NO');

  if (!code) {
    console.error('[YT AUTH] ERROR: No authorization code');
    return NextResponse.json({ error: 'No authorization code' }, { status: 400 });
  }

  try {
    console.log('[YT AUTH] Creating OAuth client...');
    const oAuth2Client = await createYouTubeOAuthClient();

    console.log('[YT AUTH] Exchanging code for tokens...');
    const { tokens } = await oAuth2Client.getToken(code);
    console.log('[YT AUTH] Tokens received:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiryDate: tokens.expiry_date
    });

    // Save tokens to session
    console.log('[YT AUTH] Getting session...');
    const session = await getSession();
    session.youtubeToken = tokens;

    console.log('[YT AUTH] Saving session...');
    await session.save();
    console.log('[YT AUTH] Session saved successfully');

    // Redirect to callback page (which will close popup)
    console.log('[YT AUTH] Redirecting to callback page');
    return NextResponse.redirect(new URL('/auth/youtube-callback', request.url));
  } catch (error: any) {
    console.error('[YT AUTH] ERROR:', error);
    console.error('[YT AUTH] Error stack:', error.stack);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
