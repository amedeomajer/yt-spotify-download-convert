import fs from 'fs/promises';

const SPOTIFY_SCOPES = [
  'user-read-email',
  'playlist-modify-public',
  'playlist-modify-private',
  'playlist-read-private',
].join(' ');

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

export async function loadSpotifyCredentials() {
  try {
    const raw = await fs.readFile(process.env.SPOTIFY_CREDENTIALS_PATH!, 'utf8');
    const cred = JSON.parse(raw);
    if (!cred.client_id || !cred.client_secret) {
      throw new Error('spotify-credentials.json must contain client_id and client_secret');
    }
    return cred;
  } catch (error) {
    console.error('Failed to load Spotify credentials:', error);
    throw new Error('Spotify credentials not configured');
  }
}

export function generateSpotifyAuthUrl(clientId: string, redirectUri: string, state: string) {
  const authUrl = new URL(SPOTIFY_AUTH_URL);
  authUrl.searchParams.append('client_id', clientId);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('redirect_uri', redirectUri);
  authUrl.searchParams.append('scope', SPOTIFY_SCOPES);
  authUrl.searchParams.append('state', state);
  return authUrl.toString();
}

export async function exchangeSpotifyCode(code: string, redirectUri: string) {
  const { client_id, client_secret } = await loadSpotifyCredentials();

  const tokenResponse = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${client_id}:${client_secret}`).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Token exchange failed: ${errorText}`);
  }

  return tokenResponse.json();
}
