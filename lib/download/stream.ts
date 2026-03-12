import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import type { DownloadFormat } from './yt-dlp-config';
import { getFilenameFromPath } from './temp-files';

/**
 * Get MIME type for a given download format
 */
export function getMimeType(format: DownloadFormat): string {
  const mimeTypes: Record<DownloadFormat, string> = {
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    mp4: 'video/mp4',
  };

  return mimeTypes[format] || 'application/octet-stream';
}

/**
 * Stream a file as an HTTP response with appropriate headers
 * for browser download
 */
export async function streamFileToResponse(
  filePath: string,
  filename: string,
  format: DownloadFormat
): Promise<Response> {
  try {
    // Get file stats
    const stats = await stat(filePath);
    const fileSize = stats.size;

    console.log(`[STREAM] Streaming file: ${filePath} (${fileSize} bytes)`);

    // Create readable stream
    const fileStream = createReadStream(filePath);

    // Convert Node.js stream to Web Stream
    const readableStream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });

        fileStream.on('end', () => {
          controller.close();
        });

        fileStream.on('error', (error) => {
          console.error('[STREAM] Stream error:', error);
          controller.error(error);
        });
      },
      cancel() {
        fileStream.destroy();
      },
    });

    // Set appropriate headers
    const headers = new Headers({
      'Content-Type': getMimeType(format),
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': fileSize.toString(),
      'Cache-Control': 'no-cache',
    });

    return new Response(readableStream, {
      headers,
      status: 200,
    });
  } catch (error) {
    console.error('[STREAM] Failed to stream file:', error);
    throw new Error(`Failed to stream file: ${error}`);
  }
}

/**
 * Create an error response for downloads
 */
export function createErrorResponse(message: string, status: number = 500): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Validate video ID format
 * YouTube video IDs are 11 characters long and contain alphanumeric characters, hyphens, and underscores
 */
export function isValidVideoId(videoId: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}

/**
 * Generate a safe filename from video title and format
 */
export function generateSafeFilename(title: string, format: DownloadFormat): string {
  // Sanitize title
  const safeTitlefull = title
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();

  // Limit length and add extension
  const safeTitle = safeTitlefull.slice(0, 200);
  return `${safeTitle}.${format}`;
}
