// youtube-cli.ts
import { google } from "googleapis";
import open from "open";
import fs from "fs/promises";
import readline from "readline";

const SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"];
const CREDENTIALS_FILE = "../../config/credentials.json";

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
  // try load token if exists
  try {
    const t = JSON.parse(await fs.readFile(tokenPath, "utf8"));
    o.setCredentials(t);
  } catch {
    // no token yet
  }
  return o;
}

// --- 1) AUTHORIZE ---
export async function authorize(tokenPath: string) {
  const oAuth2Client = await makeOAuthClient(tokenPath);
  // if already authorized, print and return
  const current = (oAuth2Client.credentials || {}) as any;
  if (current.access_token) {
    console.log("Already have token at", tokenPath);
    return;
  }

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // force refresh_token on first consent
  });
  console.log(
    "Opening browser to authorize. If it does not open, copy this URL into your browser:"
  );
  console.log(authUrl);
  await open(authUrl);

  const code = await ask("Enter the code here: ");
  const r = await oAuth2Client.getToken(code);
  const tokens = r.tokens;
  await fs.writeFile(tokenPath, JSON.stringify(tokens, null, 2), {
    mode: 0o600,
  });
  console.log("Saved token to", tokenPath);
}

// --- 2) READ playlist (fetch videoIds) ---
export async function readPlaylist(
  tokenPath: string,
  playlistId: string,
  outPath: string
) {
  const oAuth2Client = await makeOAuthClient(tokenPath);
  if (!oAuth2Client.credentials || !oAuth2Client.credentials.access_token) {
    throw new Error(
      `No token found in ${tokenPath}. Run: node youtube-cli.js authorize ${tokenPath}`
    );
  }
  const youtube = google.youtube({ version: "v3", auth: oAuth2Client });

  const ids: string[] = [];
  let pageToken: string | undefined = undefined;
  console.log(`Reading playlist ${playlistId} ...`);
  do {
    const res = await youtube.playlistItems.list({
      part: ["contentDetails"],
      playlistId,
      maxResults: 50,
      pageToken,
    });
    const items = res.data.items || [];
    for (const it of items) {
      const vid = it.contentDetails?.videoId;
      if (vid) ids.push(vid);
    }
    pageToken = res.data.nextPageToken ?? undefined;
    console.log("Fetched", ids.length, "so far...");
  } while (pageToken);
  await fs.writeFile(
    outPath,
    JSON.stringify({ playlistId, videoIds: ids }, null, 2)
  );
  console.log(`Saved ${ids.length} ids to ${outPath}`);
}

// --- 3) WRITE (create playlist + add videos) ---
async function createPlaylist(
  youtube: any,
  title: string,
  privacy: "private" | "public" | "unlisted" = "private"
) {
  const res = await youtube.playlists.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: { title },
      status: { privacyStatus: privacy },
    },
  });
  return res.data.id as string;
}

async function insertVideo(youtube: any, playlistId: string, videoId: string) {
  await youtube.playlistItems.insert({
    part: ["snippet"],
    requestBody: {
      snippet: {
        playlistId,
        resourceId: { kind: "youtube#video", videoId },
      },
    },
  });
}

// writeVideosFile is a JSON file created by readPlaylist { playlistId, videoIds: [] }
export async function writePlaylist(
  tokenPath: string,
  title: string,
  videoIdsFile: string,
  privacy: "private" | "public" | "unlisted" = "private"
) {
  const oAuth2Client = await makeOAuthClient(tokenPath);
  if (!oAuth2Client.credentials || !oAuth2Client.credentials.access_token) {
    throw new Error(
      `No token found in ${tokenPath}. Run: node youtube-cli.js authorize ${tokenPath}`
    );
  }
  const youtube = google.youtube({ version: "v3", auth: oAuth2Client });

  const raw = JSON.parse(await fs.readFile(videoIdsFile, "utf8"));
  const videoIds: string[] = raw.videoIds ?? raw; // accept either {videoIds: []} or plain array
  if (!Array.isArray(videoIds) || videoIds.length === 0) {
    throw new Error("No video IDs found in " + videoIdsFile);
  }

  console.log(`Creating playlist "${title}" with ${videoIds.length} videos...`);
  const newPlaylistId = await createPlaylist(youtube, title, privacy);
  console.log("Created playlist id:", newPlaylistId);

  // add videos with gentle pacing and simple retry
  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
  for (let i = 0; i < videoIds.length; i++) {
    const vid = videoIds[i];
    let attempts = 0;
    while (true) {
      try {
        await insertVideo(youtube, newPlaylistId, vid);
        if ((i + 1) % 25 === 0)
          console.log(`Inserted ${i + 1}/${videoIds.length}...`);
        break;
      } catch (err: any) {
        attempts++;
        const status = err?.code || err?.response?.status;
        console.warn(
          `Insert failed for ${vid} attempt ${attempts} status=${status}. Retrying...`
        );
        if (attempts > 5) {
          console.error("Too many attempts, skipping", vid);
          break;
        }
        await delay(1000 * attempts); // backoff
      }
    }
    await delay(300); // pacing between inserts
  }
  console.log("Write complete. Playlist id:", newPlaylistId);
}

// --- Simple CLI dispatcher so you can run one step at a time ---
// Usage examples printed after this file.
async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  try {
    if (cmd === "authorize") {
      const tokenPath = args[1];
      if (!tokenPath)
        throw new Error("Usage: node youtube-cli.js authorize <tokenPath>");
      await authorize(tokenPath);
    } else if (cmd === "read") {
      const tokenPath = args[1];
      const playlistId = args[2];
      const outPath = args[3] ?? `playlist-${playlistId}.json`;
      if (!tokenPath || !playlistId)
        throw new Error(
          "Usage: node youtube-cli.js read <tokenPath> <playlistId> [outPath]"
        );
      await readPlaylist(tokenPath, playlistId, outPath);
    } else if (cmd === "write") {
      const tokenPath = args[1];
      const title = args[2];
      const videoIdsFile = args[3];
      const privacy = (args[4] as any) ?? "private";
      if (!tokenPath || !title || !videoIdsFile)
        throw new Error(
          "Usage: node youtube-cli.js write <tokenPath> <title> <videoIdsFile> [privacy]"
        );
      await writePlaylist(tokenPath, title, videoIdsFile, privacy);
    } else {
      console.log("Commands:");
      console.log("  authorize <tokenPath>");
      console.log("  read <tokenPath> <playlistId> [outPath]");
      console.log("  write <tokenPath> <title> <videoIdsFile> [privacy]");
      console.log("");
      console.log("Examples:");
      console.log("  node youtube-cli.js authorize token-src1.json");
      console.log(
        "  node youtube-cli.js read token-src1.json PLxxxxxxx src1.json"
      );
      console.log(
        "  node youtube-cli.js read token-src2.json PLyyyyyyy src2.json"
      );
      console.log(
        "  # locally dedupe/merge src1.json & src2.json -> merged.json (see tips below)"
      );
      console.log(
        '  node youtube-cli.js write token-target.json "Merged Playlist" merged.json private'
      );
    }
  } catch (e: any) {
    console.error("Error:", e.message || e);
    process.exit(1);
  }
}

if (require.main === module) main();
