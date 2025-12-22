import { Router } from 'express';
import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

const YOUTUBE_SCOPES = ['https://www.googleapis.com/auth/youtube.force-ssl'];
const CREDENTIALS_PATH = path.join(__dirname, '../../../config/credentials.json');

// Helper to load YouTube credentials
async function loadYouTubeCredentials() {
  try {
    const raw = await fs.readFile(CREDENTIALS_PATH, 'utf8');
    const cred = JSON.parse(raw);
    const config = cred.installed || cred.web;
    if (!config) throw new Error('credentials.json must contain "installed" or "web"');
    return config;
  } catch (error) {
    console.error('Failed to load YouTube credentials:', error);
    throw new Error('YouTube credentials not configured');
  }
}

// Create YouTube OAuth2 client
async function createYouTubeOAuthClient() {
  const { client_id, client_secret } = await loadYouTubeCredentials();
  const redirect_uri = 'http://localhost:3000/auth/youtube/callback';
  return new google.auth.OAuth2(client_id, client_secret, redirect_uri);
}

// Check authentication status
router.get('/status', (req, res) => {
  res.json({
    youtube: !!req.session.youtubeToken,
    spotify: !!req.session.spotifyToken,
  });
});

// YouTube OAuth - Step 1: Redirect to Google
router.get('/youtube', async (req, res) => {
  try {
    const oAuth2Client = await createYouTubeOAuthClient();
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: YOUTUBE_SCOPES,
      prompt: 'consent',
    });
    res.redirect(authUrl);
  } catch (error: any) {
    console.error('YouTube OAuth error:', error);
    res.status(500).json({ error: error.message });
  }
});

// YouTube OAuth - Step 2: Handle callback
router.get('/youtube/callback', async (req, res) => {
  try {
    const code = req.query.code as string;
    if (!code) {
      throw new Error('No authorization code received');
    }

    const oAuth2Client = await createYouTubeOAuthClient();
    const { tokens } = await oAuth2Client.getToken(code);

    // Store tokens in session
    req.session.youtubeToken = tokens;

    // Redirect back to frontend
    res.redirect('http://localhost:5173');
  } catch (error: any) {
    console.error('YouTube callback error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Spotify OAuth - to be implemented
router.get('/spotify', (req, res) => {
  res.json({ message: 'Spotify OAuth - coming soon' });
});

router.get('/spotify/callback', (req, res) => {
  res.json({ message: 'Spotify callback - coming soon' });
});

export { router as authRouter };
