import fs from "fs/promises";

interface Playlist {
  playlistId: string;
  videoIds: string[];
}

async function mergePlaylists(file1: string, file2: string, outputFile: string) {
  // Use async/await with fs.promises
  const playlist1: Playlist = JSON.parse(await fs.readFile(file1, "utf8"));
  const playlist2: Playlist = JSON.parse(await fs.readFile(file2, "utf8"));

  // Combine and deduplicate
  const allVideoIds = [...playlist2.videoIds, ...playlist1.videoIds];
  const uniqueVideoIds = [...new Set(allVideoIds)];

  const merged: Playlist = {
    playlistId: "merged",
    videoIds: uniqueVideoIds
  };

  await fs.writeFile(outputFile, JSON.stringify(merged, null, 2));

  console.log(`Merged ${playlist1.videoIds.length} + ${playlist2.videoIds.length} = ${allVideoIds.length} videos`);
  console.log(`After deduplication: ${uniqueVideoIds.length} unique videos`);
  console.log(`Saved to ${outputFile}`);
}

// CLI support
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.log("Usage: tsx merge-playlists.ts <file1> <file2> <outputFile>");
    console.log("Example: tsx merge-playlists.ts data/playlists/playlist1.json data/playlists/playlist2.json data/playlists/merged.json");
    process.exit(1);
  }

  const [file1, file2, output] = args;
  await mergePlaylists(file1, file2, output);
}

if (require.main === module) {
  main().catch(console.error);
}
