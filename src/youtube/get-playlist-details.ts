import { google } from "googleapis";
import fs from "fs/promises";

const SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"];
const CREDENTIALS_FILE = "../../config/credentials.json";

async function loadCredentials(path = CREDENTIALS_FILE) {
  const raw = await fs.readFile(path, "utf8");
  return JSON.parse(raw);
}

async function makeOAuthClient(tokenPath: string) {
  const cred = await loadCredentials();
  const installed = cred.installed || cred.web;
  if (!installed)
    throw new Error('credentials.json must contain "installed" or "web"');
  const { client_id, client_secret, redirect_uris } = installed;
  const o = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  const t = JSON.parse(await fs.readFile(tokenPath, "utf8"));
  o.setCredentials(t);
  return o;
}

async function getPlaylistDetails(
  tokenPath: string,
  playlistId: string,
  outPath: string
) {
  const oAuth2Client = await makeOAuthClient(tokenPath);
  const youtube = google.youtube({ version: "v3", auth: oAuth2Client });

  console.log(`Fetching playlist ${playlistId} with full details...`);

  // Get all playlist items with snippet data
  const songs: any[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const res = await youtube.playlistItems.list({
      part: ["snippet", "contentDetails"],
      playlistId,
      maxResults: 50,
      pageToken,
    });

    const items = res.data.items || [];

    for (const item of items) {
      const snippet = item.snippet;
      const videoId = item.contentDetails?.videoId;

      if (videoId && snippet) {
        songs.push({
          videoId: videoId,
          title: snippet.title,
          artist: snippet.videoOwnerChannelTitle || snippet.channelTitle,
          channelId: snippet.channelId,
          publishedAt: snippet.publishedAt,
          thumbnail: snippet.thumbnails?.default?.url,
          description: snippet.description,
          position: snippet.position
        });
      }
    }

    pageToken = res.data.nextPageToken ?? undefined;
    console.log(`Fetched ${songs.length} videos so far...`);
  } while (pageToken);

  // Save to file
  await fs.writeFile(
    outPath,
    JSON.stringify({ playlistId, totalSongs: songs.length, songs }, null, 2)
  );

  console.log(`\n✅ Saved ${songs.length} songs with details to ${outPath}`);
}

// Main
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.log("Usage: tsx get-playlist-details.ts <tokenPath> <playlistId> <outPath>");
    console.log("Example: tsx get-playlist-details.ts token-src1.json PLyxY0XhroddolQkn3V05z2rKubIPbx-HE nostalgia-details.json");
    process.exit(1);
  }

  const [tokenPath, playlistId, outPath] = args;
  await getPlaylistDetails(tokenPath, playlistId, outPath);
}

if (require.main === module) main();
