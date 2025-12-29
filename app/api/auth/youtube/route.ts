import { NextResponse } from 'next/server';
import { createYouTubeOAuthClient, generateYouTubeAuthUrl } from '@/lib/auth/youtube';

export async function GET() {
  console.log('[YT AUTH] Starting YouTube OAuth flow...');
  try {
    console.log('[YT AUTH] Creating OAuth client...');
    const oAuth2Client = await createYouTubeOAuthClient();

    console.log('[YT AUTH] Generating auth URL...');
    const authUrl = generateYouTubeAuthUrl(oAuth2Client);
    console.log('[YT AUTH] Auth URL generated:', authUrl.substring(0, 50) + '...');

    console.log('[YT AUTH] Redirecting to YouTube...');
    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error('[YT AUTH] ERROR:', error);
    console.error('[YT AUTH] Error stack:', error.stack);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
