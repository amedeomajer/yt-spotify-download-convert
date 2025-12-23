import { NextResponse } from 'next/server';
import { createYouTubeOAuthClient, generateYouTubeAuthUrl } from '@/lib/auth/youtube';

export async function GET() {
  try {
    const oAuth2Client = await createYouTubeOAuthClient();
    const authUrl = generateYouTubeAuthUrl(oAuth2Client);

    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error('YouTube OAuth error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
