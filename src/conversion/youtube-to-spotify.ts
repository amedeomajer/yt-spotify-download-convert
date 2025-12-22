// youtube-to-spotify.ts
import fs from "fs/promises";
import {
  searchTrack,
  createPlaylist,
  addTracksToPlaylist,
} from "../spotify/spotify-client";

interface SpotifyClient {
  accessToken: string;
  refreshToken?: string;
}

interface YouTubeSong {
  videoId: string;
  title: string;
  artist: string;
  channelId: string;
  publishedAt: string;
  thumbnail: string;
  description: string;
  position: number;
}

interface YouTubePlaylistData {
  playlistId: string;
  totalSongs: number;
  songs: YouTubeSong[];
}

interface SpotifyMatch {
  youtubeData: YouTubeSong;
  spotifyTrack: any;
  tier: number;
}

interface NotFoundSong {
  videoId: string;
  title: string;
  artist: string;
  position: number;
  searchAttempts: {
    tier: number;
    query: string;
    resultsCount: number;
  }[];
}

// --- Helper: Clean title for better matching ---
function cleanTitle(title: string): string {
  return (
    title
      // Remove content in parentheses (often remix/version info)
      .replace(/\([^)]*\)/g, "")
      // Remove content in brackets
      .replace(/\[[^\]]*\]/g, "")
      // Remove special characters except spaces and hyphens
      .replace(/[^\w\s-]/g, "")
      // Remove extra whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}

// --- Helper: Extract remix artist from title ---
function extractRemixArtist(title: string): string | null {
  const remixMatch = title.match(/\(([^)]+)\s+Remix\)/i);
  if (remixMatch) {
    return remixMatch[1];
  }
  return null;
}

// --- Helper: Calculate string similarity (simple Levenshtein-like) ---
function similarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(
    longer.toLowerCase(),
    shorter.toLowerCase()
  );
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) {
      costs[s2.length] = lastValue;
    }
  }
  return costs[s2.length];
}

// --- Multi-tier search strategy ---
async function searchForSong(
  client: SpotifyClient,
  song: YouTubeSong
): Promise<SpotifyMatch | null> {
  const searchAttempts: NotFoundSong["searchAttempts"] = [];

  // Clean artist name (remove "- Topic" suffix common on YouTube)
  const cleanArtist = song.artist.replace(/\s*-\s*Topic\s*$/i, "").trim();
  const remixArtist = extractRemixArtist(song.title);

  // Tier 1: Exact match with artist and title
  try {
    const query1 = `artist:"${cleanArtist}" track:"${song.title}"`;
    const results1 = await searchTrack(client, query1, 5);
    searchAttempts.push({ tier: 1, query: query1, resultsCount: results1.length });

    if (results1.length > 0) {
      // Check if first result is a good match
      const firstResult = results1[0];
      const artistMatch = firstResult.artists.some((a: any) =>
        similarity(a.name, cleanArtist) > 0.7
      );
      const titleMatch = similarity(firstResult.name, song.title) > 0.7;

      if (artistMatch && titleMatch) {
        return { youtubeData: song, spotifyTrack: firstResult, tier: 1 };
      }
    }
  } catch (err) {
    console.warn(`Tier 1 search failed for "${song.title}":`, err);
  }

  // Small delay to avoid rate limiting
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Tier 2: Cleaned title with artist
  try {
    const cleaned = cleanTitle(song.title);
    const query2 = `${cleanArtist} ${cleaned}`;
    const results2 = await searchTrack(client, query2, 10);
    searchAttempts.push({ tier: 2, query: query2, resultsCount: results2.length });

    if (results2.length > 0) {
      // Look for best match in top results
      for (const result of results2.slice(0, 5)) {
        const artistMatch = result.artists.some((a: any) => {
          const artistSim = similarity(a.name, cleanArtist);
          const remixSim = remixArtist ? similarity(a.name, remixArtist) : 0;
          return artistSim > 0.6 || remixSim > 0.6;
        });
        const titleMatch = similarity(result.name, cleaned) > 0.6;

        if (artistMatch || titleMatch) {
          return { youtubeData: song, spotifyTrack: result, tier: 2 };
        }
      }
    }
  } catch (err) {
    console.warn(`Tier 2 search failed for "${song.title}":`, err);
  }

  await new Promise((resolve) => setTimeout(resolve, 300));

  // Tier 3: Title-only search with loose matching
  try {
    const cleaned = cleanTitle(song.title);
    const query3 = cleaned;
    const results3 = await searchTrack(client, query3, 20);
    searchAttempts.push({ tier: 3, query: query3, resultsCount: results3.length });

    if (results3.length > 0) {
      // Look for any reasonable match
      for (const result of results3.slice(0, 10)) {
        const titleMatch = similarity(result.name, cleaned) > 0.5;
        if (titleMatch) {
          return { youtubeData: song, spotifyTrack: result, tier: 3 };
        }
      }
    }
  } catch (err) {
    console.warn(`Tier 3 search failed for "${song.title}":`, err);
  }

  // No match found
  return null;
}

// --- Load Spotify token ---
async function makeSpotifyClient(tokenPath: string): Promise<SpotifyClient> {
  try {
    const tokenData = JSON.parse(await fs.readFile(tokenPath, "utf8"));
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

// --- Main conversion function ---
async function convertPlaylist(
  jsonPath: string,
  playlistName: string,
  tokenPath: string = "token-spotify.json"
) {
  console.log("\n=== YouTube to Spotify Playlist Converter ===\n");

  // Load YouTube playlist data
  console.log(`Loading YouTube playlist data from ${jsonPath}...`);
  const raw = await fs.readFile(jsonPath, "utf8");
  const playlistData: YouTubePlaylistData = JSON.parse(raw);

  console.log(
    `✓ Loaded playlist with ${playlistData.totalSongs} songs\n`
  );

  // Load Spotify client
  console.log("Connecting to Spotify...");
  const client = await makeSpotifyClient(tokenPath);
  console.log("✓ Connected to Spotify\n");

  // Search for each song
  console.log("Searching for songs on Spotify...\n");
  const matched: SpotifyMatch[] = [];
  const notFound: NotFoundSong[] = [];

  for (let i = 0; i < playlistData.songs.length; i++) {
    const song = playlistData.songs[i];
    const progress = `[${i + 1}/${playlistData.songs.length}]`;

    process.stdout.write(`${progress} Searching: ${song.title}...`);

    const match = await searchForSong(client, song);

    if (match) {
      matched.push(match);
      console.log(
        ` ✓ Found (Tier ${match.tier}): ${match.spotifyTrack.name} - ${match.spotifyTrack.artists.map((a: any) => a.name).join(", ")}`
      );
    } else {
      console.log(` ✗ Not found`);
      notFound.push({
        videoId: song.videoId,
        title: song.title,
        artist: song.artist,
        position: song.position,
        searchAttempts: [],
      });
    }
  }

  console.log("\n=== Search Results ===");
  console.log(`Total songs: ${playlistData.totalSongs}`);
  console.log(`Matched: ${matched.length} (${((matched.length / playlistData.totalSongs) * 100).toFixed(1)}%)`);
  console.log(`Not found: ${notFound.length}`);
  console.log();

  if (matched.length === 0) {
    console.log("No songs were matched. Cannot create empty playlist.");
    return;
  }

  // Create Spotify playlist
  console.log(`Creating Spotify playlist "${playlistName}"...`);
  const description = `Converted from YouTube playlist ${playlistData.playlistId}. Contains ${matched.length}/${playlistData.totalSongs} songs.`;
  const playlistId = await createPlaylist(client, playlistName, description, false);
  console.log(`✓ Created playlist: https://open.spotify.com/playlist/${playlistId}\n`);

  // Add tracks to playlist
  console.log("Adding tracks to playlist...");
  const trackUris = matched.map((m) => m.spotifyTrack.uri);
  await addTracksToPlaylist(client, playlistId, trackUris);
  console.log(`✓ Added ${trackUris.length} tracks\n`);

  // Save not-found songs
  if (notFound.length > 0) {
    const notFoundPath = "not-found-songs.json";
    await fs.writeFile(
      notFoundPath,
      JSON.stringify({ totalNotFound: notFound.length, songs: notFound }, null, 2)
    );
    console.log(`✓ Saved ${notFound.length} not-found songs to ${notFoundPath}\n`);
  }

  // Final summary
  console.log("=== Conversion Complete! ===");
  console.log(`Playlist URL: https://open.spotify.com/playlist/${playlistId}`);
  console.log(`Songs added: ${matched.length}/${playlistData.totalSongs}`);
  console.log(
    `Match rate: ${((matched.length / playlistData.totalSongs) * 100).toFixed(1)}%`
  );
  if (notFound.length > 0) {
    console.log(`\nReview not-found songs in: not-found-songs.json`);
  }
  console.log();
}

// --- CLI ---
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log("Usage: tsx youtube-to-spotify.ts <json-file> <playlist-name> [token-path]");
    console.log("");
    console.log("Examples:");
    console.log(
      '  tsx youtube-to-spotify.ts nostalgia-dubstep-details.json "Nostalgia Dubstep"'
    );
    console.log(
      '  tsx youtube-to-spotify.ts playlist.json "My Playlist" token-spotify.json'
    );
    console.log("");
    console.log("Before running this, make sure you have:");
    console.log("  1. Set up Spotify credentials: tsx spotify-client.ts setup");
    console.log("  2. Authorized with Spotify: tsx spotify-client.ts authorize token-spotify.json");
    process.exit(1);
  }

  const jsonPath = args[0];
  const playlistName = args[1];
  const tokenPath = args[2] || "token-spotify.json";

  try {
    await convertPlaylist(jsonPath, playlistName, tokenPath);
  } catch (e: any) {
    console.error("\nError:", e.message || e);
    process.exit(1);
  }
}

if (require.main === module) main();
