import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

export async function GET() {
  console.log('[AUTH STATUS] Checking auth status...');
  const session = await getSession();

  const status = {
    youtube: !!session.youtubeToken,
    spotify: !!session.spotifyToken,
  };

  console.log('[AUTH STATUS] Status:', status);
  if (session.youtubeToken) {
    console.log('[AUTH STATUS] YouTube token details:', {
      hasAccessToken: !!session.youtubeToken.access_token,
      hasRefreshToken: !!session.youtubeToken.refresh_token,
      expiryDate: session.youtubeToken.expiry_date
    });
  }
  if (session.spotifyToken) {
    console.log('[AUTH STATUS] Spotify token details:', {
      hasAccessToken: !!session.spotifyToken.access_token,
      hasRefreshToken: !!session.spotifyToken.refresh_token,
      expiresIn: session.spotifyToken.expires_in
    });
  }

  return NextResponse.json(status);
}
