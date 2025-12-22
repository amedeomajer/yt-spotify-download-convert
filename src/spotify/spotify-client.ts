// spotify-client.ts
import fs from "fs/promises";
import open from "open";
import readline from "readline";
import http from "http";
import { URL } from "url";

const SCOPES = [
  "playlist-modify-public",
  "playlist-modify-private",
  "playlist-read-private",
].join(" ");
const SPOTIFY_CREDENTIALS_FILE = "../../config/spotify-credentials.json";
const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

// --- Helpers ---
function ask(question: string) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise<string>((res) =>
    rl.question(question, (ans) => {
      rl.close();
      res(ans.trim());
    })
  );
}

async function loadSpotifyCredentials(path = SPOTIFY_CREDENTIALS_FILE) {
  const raw = await fs.readFile(path, "utf8");
  return JSON.parse(raw);
}

interface SpotifyToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

interface SpotifyClient {
  accessToken: string;
  refreshToken?: string;
}

async function makeSpotifyClient(tokenPath: string): Promise<SpotifyClient> {
  try {
    const tokenData: SpotifyToken = JSON.parse(
      await fs.readFile(tokenPath, "utf8")
    );
    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
    };
  } catch {
    throw new Error(
      `No token found at ${tokenPath}. Run: tsx spotify-client.ts authorize ${tokenPath}`
    );
  }
}

// --- 1) AUTHORIZE ---
export async function authorizeSpotify(tokenPath: string) {
  const creds = await loadSpotifyCredentials();
  const { client_id, client_secret, redirect_uri } = creds;

  if (!client_id || !client_secret || !redirect_uri) {
    throw new Error(
      "spotify-credentials.json must contain client_id, client_secret, and redirect_uri"
    );
  }

  // Check if already authorized
  try {
    const existing = await makeSpotifyClient(tokenPath);
    if (existing.accessToken) {
      console.log("Already have token at", tokenPath);
      return;
    }
  } catch {
    // No token yet, continue with auth
  }

  console.log("\n=== Spotify Authorization Flow ===\n");

  // Extract port from redirect_uri (works with both localhost and ngrok)
  const redirectUrl = new URL(redirect_uri);
  const port = redirectUrl.port ? parseInt(redirectUrl.port) : 8888;
  const callbackPath = redirectUrl.pathname;

  console.log(`Using redirect URI: ${redirect_uri}`);
  console.log(`Local server will listen on port: ${port}`);
  console.log(`Callback path: ${callbackPath}\n`);

  // Generate random state for security
  const state = Math.random().toString(36).substring(7);

  // Build authorization URL
  const authUrl = new URL(SPOTIFY_AUTH_URL);
  authUrl.searchParams.append("client_id", client_id);
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("redirect_uri", redirect_uri);
  authUrl.searchParams.append("scope", SCOPES);
  authUrl.searchParams.append("state", state);

  console.log("Opening browser to authorize...");
  console.log("If it doesn't open, copy this URL:\n");
  console.log(authUrl.toString());
  console.log();

  // Start local server to capture redirect
  const authCode = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost:${port}`);

      if (url.pathname === callbackPath) {
        const code = url.searchParams.get("code");
        const returnedState = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(`<h1>Authorization failed: ${error}</h1>`);
          server.close();
          reject(new Error(`Authorization failed: ${error}`));
          return;
        }

        if (returnedState !== state) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end("<h1>State mismatch - possible CSRF attack</h1>");
          server.close();
          reject(new Error("State mismatch"));
          return;
        }

        if (code) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(
            "<h1>Authorization successful!</h1><p>You can close this window and return to the terminal.</p>"
          );
          server.close();
          resolve(code);
        } else {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end("<h1>No authorization code received</h1>");
          server.close();
          reject(new Error("No code received"));
        }
      } else {
        res.writeHead(404, { "Content-Type": "text/html" });
        res.end("<h1>Not found</h1>");
      }
    });

    server.listen(port, () => {
      console.log(`Local server started on port ${port}`);
      console.log(`Waiting for Spotify redirect to: ${redirect_uri}`);
      open(authUrl.toString());
    });

    server.on("error", (err) => {
      reject(err);
    });
  });

  console.log("\nReceived authorization code, exchanging for tokens...");

  // Exchange code for tokens
  const tokenResponse = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " + Buffer.from(`${client_id}:${client_secret}`).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: authCode,
      redirect_uri: redirect_uri,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const tokens: SpotifyToken = await tokenResponse.json();

  // Save tokens
  await fs.writeFile(tokenPath, JSON.stringify(tokens, null, 2), {
    mode: 0o600,
  });

  console.log("✓ Saved token to", tokenPath);
  console.log("✓ Authorization complete!");
}

// --- 2) SEARCH TRACK ---
export async function searchTrack(
  client: SpotifyClient,
  query: string,
  limit: number = 5
): Promise<any[]> {
  const url = new URL(`${SPOTIFY_API_BASE}/search`);
  url.searchParams.append("q", query);
  url.searchParams.append("type", "track");
  url.searchParams.append("limit", limit.toString());

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${client.accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Search failed: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.tracks?.items || [];
}

// --- 3) CREATE PLAYLIST ---
export async function createPlaylist(
  client: SpotifyClient,
  name: string,
  description: string = "",
  isPublic: boolean = false
): Promise<string> {
  // First, get current user ID
  const userResponse = await fetch(`${SPOTIFY_API_BASE}/me`, {
    headers: {
      Authorization: `Bearer ${client.accessToken}`,
    },
  });

  if (!userResponse.ok) {
    throw new Error(`Failed to get user info: ${userResponse.status}`);
  }

  const userData = await userResponse.json();
  const userId = userData.id;

  // Create playlist
  const response = await fetch(
    `${SPOTIFY_API_BASE}/users/${userId}/playlists`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${client.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        description,
        public: isPublic,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create playlist: ${response.status} ${error}`);
  }

  const playlist = await response.json();
  return playlist.id;
}

// --- 4) ADD TRACKS TO PLAYLIST ---
export async function addTracksToPlaylist(
  client: SpotifyClient,
  playlistId: string,
  trackUris: string[]
): Promise<void> {
  // Spotify allows max 100 tracks per request
  const batchSize = 100;

  for (let i = 0; i < trackUris.length; i += batchSize) {
    const batch = trackUris.slice(i, i + batchSize);

    const response = await fetch(
      `${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uris: batch,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Failed to add tracks (batch ${i / batchSize + 1}): ${response.status} ${error}`
      );
    }

    console.log(`Added ${batch.length} tracks (${i + batch.length}/${trackUris.length})`);
  }
}

// --- CLI dispatcher ---
async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  try {
    if (cmd === "setup") {
      console.log("\n=== Spotify Developer Setup Guide (with ngrok) ===\n");

      console.log("Step 0: Install and Start ngrok");
      console.log("  Note: Spotify requires a public redirect URI, so we use ngrok");
      console.log("  1. Install ngrok: https://ngrok.com/download");
      console.log("  2. In a NEW terminal window, run:");
      console.log("     ngrok http 8888");
      console.log("  3. Copy the 'Forwarding' HTTPS URL (e.g., https://abc123.ngrok-free.app)");
      console.log("  4. Keep this terminal open - ngrok must stay running!\n");

      console.log("Step 1: Create Spotify Developer Account");
      console.log("  1. Go to: https://developer.spotify.com/dashboard");
      console.log("  2. Log in with your Spotify account (or create one)");
      console.log("  3. Accept the Terms of Service\n");

      console.log("Step 2: Create a New App");
      console.log('  1. Click "Create App"');
      console.log("  2. Fill in:");
      console.log('     - App Name: "YouTube to Spotify Playlist Converter"');
      console.log('     - App Description: "Personal tool to convert YouTube playlists"');
      console.log("     - Redirect URI: https://YOUR_NGROK_URL.ngrok-free.app/callback");
      console.log("       (Replace YOUR_NGROK_URL with your actual ngrok URL!)");
      console.log("     - APIs used: Web API");
      console.log('  3. Click "Save"\n');

      console.log("Step 3: Get Your Credentials");
      console.log('  1. On your app dashboard, click "Settings"');
      console.log("  2. Copy your Client ID");
      console.log('  3. Click "View client secret" and copy it');
      console.log("  4. Create a file: spotify-credentials.json");
      console.log("  5. Paste this structure:\n");
      console.log("     {");
      console.log('       "client_id": "your_client_id_here",');
      console.log('       "client_secret": "your_client_secret_here",');
      console.log('       "redirect_uri": "https://YOUR_NGROK_URL.ngrok-free.app/callback"');
      console.log("     }\n");
      console.log("  IMPORTANT: Make sure ngrok is still running!\n");

      console.log("Step 4: Run the Authorization");
      console.log("  Run: tsx spotify-client.ts authorize token-spotify.json");
      console.log("  - A browser will open for authorization");
      console.log("  - After you approve, Spotify will redirect to your ngrok URL");
      console.log("  - ngrok will forward the request to your local server");
      console.log("  - The authorization code will be captured automatically\n");
    } else if (cmd === "authorize") {
      const tokenPath = args[1];
      if (!tokenPath) {
        throw new Error(
          "Usage: tsx spotify-client.ts authorize <tokenPath>"
        );
      }
      await authorizeSpotify(tokenPath);
    } else if (cmd === "test-search") {
      const tokenPath = args[1];
      const query = args.slice(2).join(" ");
      if (!tokenPath || !query) {
        throw new Error(
          "Usage: tsx spotify-client.ts test-search <tokenPath> <query>"
        );
      }
      const client = await makeSpotifyClient(tokenPath);
      const results = await searchTrack(client, query, 5);
      console.log(`\nFound ${results.length} results for "${query}":\n`);
      results.forEach((track, idx) => {
        console.log(
          `${idx + 1}. ${track.name} - ${track.artists.map((a: any) => a.name).join(", ")}`
        );
        console.log(`   URI: ${track.uri}`);
        console.log(`   Album: ${track.album.name}`);
        console.log();
      });
    } else {
      console.log("Commands:");
      console.log("  setup                              - Show Spotify Developer setup guide");
      console.log("  authorize <tokenPath>              - Authorize with Spotify");
      console.log("  test-search <tokenPath> <query>    - Test search functionality");
      console.log("");
      console.log("Examples:");
      console.log("  tsx spotify-client.ts setup");
      console.log("  tsx spotify-client.ts authorize token-spotify.json");
      console.log('  tsx spotify-client.ts test-search token-spotify.json "Noosa Walk on by"');
    }
  } catch (e: any) {
    console.error("Error:", e.message || e);
    process.exit(1);
  }
}

if (require.main === module) main();
