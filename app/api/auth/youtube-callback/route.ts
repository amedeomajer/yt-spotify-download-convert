import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { createYouTubeOAuthClient } from '@/lib/auth/youtube';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'No authorization code' }, { status: 400 });
  }

  try {
    const oAuth2Client = await createYouTubeOAuthClient();
    const { tokens } = await oAuth2Client.getToken(code);

    // Save tokens to session
    const session = await getSession();
    session.youtubeToken = tokens;
    await session.save();

    // Redirect to callback page (which will close popup)
    return NextResponse.redirect(new URL('/auth/youtube-callback', request.url));
  } catch (error: any) {
    console.error('YouTube callback error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
