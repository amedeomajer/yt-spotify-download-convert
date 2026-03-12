import { spawn } from 'child_process';
import { YTDLP_CONFIG, type DownloadFormat, isAudioFormat } from './yt-dlp-config';

export interface DownloadOptions {
  videoId?: string;
  url?: string;
  format: DownloadFormat;
  outputPath: string;
  filename?: string;
}

export interface VideoInfo {
  id: string;
  title: string;
  duration: number;
  filesize?: number;
  ext: string;
}

/**
 * Build yt-dlp command arguments based on format and options
 */
export function buildYtdlpCommand(options: DownloadOptions): string[] {
  const { format, outputPath, filename, videoId, url } = options;

  // Determine the input URL
  const inputUrl = url || `https://www.youtube.com/watch?v=${videoId}`;

  // Base arguments
  const args: string[] = [];

  // Output template
  const outputTemplate = filename
    ? `${outputPath}/${filename}.%(ext)s`
    : `${outputPath}/%(title)s.%(ext)s`;
  args.push('--output', outputTemplate);

  // Disable playlist processing (only download single video)
  args.push('--no-playlist');

  // Format-specific arguments
  if (isAudioFormat(format)) {
    // Audio extraction
    args.push('--extract-audio');
    args.push('--audio-format', format);

    if (format === 'mp3') {
      args.push('--audio-quality', YTDLP_CONFIG.audioQuality);
    }
  } else {
    // Video download (mp4)
    args.push('--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best');
    args.push('--merge-output-format', 'mp4');
  }

  // Add the URL as the last argument
  args.push(inputUrl);

  return args;
}

/**
 * Download a video or audio using yt-dlp
 * Returns the path to the downloaded file
 */
export async function downloadVideo(options: DownloadOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = buildYtdlpCommand(options);

    console.log(`[DOWNLOAD] Executing: ${YTDLP_CONFIG.binaryPath} ${args.join(' ')}`);

    const process = spawn(YTDLP_CONFIG.binaryPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let downloadedFilePath = '';

    // Capture stdout for file path extraction
    process.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`[DOWNLOAD] ${output.trim()}`);

      // Try to extract the destination file path
      const destinationMatch = output.match(/\[download\] Destination: (.+)/);
      if (destinationMatch) {
        downloadedFilePath = destinationMatch[1].trim();
      }

      // Check for audio extraction (this is the FINAL file after conversion)
      const extractAudioMatch = output.match(/\[ExtractAudio\] Destination: (.+)/);
      if (extractAudioMatch) {
        downloadedFilePath = extractAudioMatch[1].trim();
      }

      // Also check for merger output
      const mergerMatch = output.match(/\[Merger\] Merging formats into "(.+)"/);
      if (mergerMatch) {
        downloadedFilePath = mergerMatch[1].trim();
      }
    });

    process.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      console.error(`[DOWNLOAD] ${output.trim()}`);
    });

    // Set timeout
    const timeoutId = setTimeout(() => {
      process.kill();
      reject(new Error(`Download timed out after ${YTDLP_CONFIG.timeout}ms`));
    }, YTDLP_CONFIG.timeout);

    process.on('close', (code) => {
      clearTimeout(timeoutId);

      if (code === 0) {
        if (downloadedFilePath) {
          console.log(`[DOWNLOAD] Success: ${downloadedFilePath}`);
          resolve(downloadedFilePath);
        } else {
          // If we couldn't extract the path from output, construct it
          const { outputPath, filename, format } = options;
          const ext = isAudioFormat(format) ? format : 'mp4';
          const fallbackPath = filename
            ? `${outputPath}/${filename}.${ext}`
            : `${outputPath}/video.${ext}`;
          console.log(`[DOWNLOAD] Could not extract path, using fallback: ${fallbackPath}`);
          resolve(fallbackPath);
        }
      } else {
        const error = stderr || stdout || 'Unknown error';
        console.error(`[DOWNLOAD] Failed with code ${code}: ${error}`);
        reject(new Error(`yt-dlp failed: ${error}`));
      }
    });

    process.on('error', (error) => {
      clearTimeout(timeoutId);
      console.error(`[DOWNLOAD] Process error:`, error);

      if ((error as any).code === 'ENOENT') {
        reject(new Error('yt-dlp is not installed. Please install it: brew install yt-dlp'));
      } else {
        reject(error);
      }
    });
  });
}

/**
 * Get video information without downloading
 */
export async function getVideoInfo(videoIdOrUrl: string): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const inputUrl = videoIdOrUrl.startsWith('http')
      ? videoIdOrUrl
      : `https://www.youtube.com/watch?v=${videoIdOrUrl}`;

    const args = ['--dump-json', '--no-playlist', inputUrl];

    console.log(`[DOWNLOAD] Getting video info: ${videoIdOrUrl}`);

    const process = spawn(YTDLP_CONFIG.binaryPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const timeoutId = setTimeout(() => {
      process.kill();
      reject(new Error('Video info request timed out'));
    }, 30000); // 30 second timeout for info

    process.on('close', (code) => {
      clearTimeout(timeoutId);

      if (code === 0) {
        try {
          const info = JSON.parse(stdout);
          resolve({
            id: info.id,
            title: info.title,
            duration: info.duration,
            filesize: info.filesize || info.filesize_approx,
            ext: info.ext,
          });
        } catch (error) {
          reject(new Error(`Failed to parse video info: ${error}`));
        }
      } else {
        reject(new Error(`Failed to get video info: ${stderr || 'Unknown error'}`));
      }
    });

    process.on('error', (error) => {
      clearTimeout(timeoutId);

      if ((error as any).code === 'ENOENT') {
        reject(new Error('yt-dlp is not installed'));
      } else {
        reject(error);
      }
    });
  });
}
