import { google } from 'googleapis';
import fs from 'fs/promises';

const YOUTUBE_SCOPES = ['https://www.googleapis.com/auth/youtube.force-ssl'];

export async function loadYouTubeCredentials() {
  try {
    const raw = await fs.readFile(process.env.YOUTUBE_CREDENTIALS_PATH!, 'utf8');
    const cred = JSON.parse(raw);
    const config = cred.installed || cred.web;
    if (!config) throw new Error('credentials.json must contain "installed" or "web"');
    return config;
  } catch (error) {
    console.error('Failed to load YouTube credentials:', error);
    throw new Error('YouTube credentials not configured');
  }
}

export async function createYouTubeOAuthClient() {
  const { client_id, client_secret } = await loadYouTubeCredentials();
  const redirect_uri = process.env.YOUTUBE_REDIRECT_URI;
  return new google.auth.OAuth2(client_id, client_secret, redirect_uri);
}

export function generateYouTubeAuthUrl(oAuth2Client: any) {
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: YOUTUBE_SCOPES,
    prompt: 'consent',
  });
}
