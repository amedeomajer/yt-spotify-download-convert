import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { downloadVideo } from '@/lib/download/yt-dlp';
import { createTempDir, cleanupTempFiles, sanitizeFilename } from '@/lib/download/temp-files';
import {
  streamFileToResponse,
  createErrorResponse,
  isValidVideoId,
  generateSafeFilename,
} from '@/lib/download/stream';
import type { DownloadFormat } from '@/lib/download/yt-dlp-config';

interface DownloadRequest {
  videoId?: string;
  url?: string;
  format: DownloadFormat;
  title?: string;
}

export async function POST(request: NextRequest) {
  let tempDir: string | null = null;

  try {
    // Parse request body
    const body: DownloadRequest = await request.json();
    const { videoId, url, format, title } = body;

    // Validate inputs
    if (!videoId && !url) {
      return createErrorResponse('Either videoId or url is required', 400);
    }

    if (!format || !['mp3', 'm4a', 'mp4'].includes(format)) {
      return createErrorResponse('Invalid format. Must be mp3, m4a, or mp4', 400);
    }

    // Validate videoId if provided
    if (videoId && !isValidVideoId(videoId)) {
      return createErrorResponse('Invalid video ID format', 400);
    }

    // Check authentication (optional - allow downloads without auth if URL is provided)
    // Authentication is only required if using videoId without a URL
    const session = await getSession();
    const isAuthenticated = !!session.youtubeToken;

    // If using videoId (from authenticated flow), check auth
    // If using URL (direct paste), auth not required
    if (videoId && !url && !isAuthenticated) {
      return createErrorResponse(
        'Authentication required for video ID access. Use a direct YouTube URL instead.',
        401
      );
    }

    console.log(`[DOWNLOAD API] Request: ${videoId || url}, format: ${format}`);

    // Create temp directory
    tempDir = await createTempDir();

    // Prepare filename
    const sanitizedTitle = title ? sanitizeFilename(title) : videoId || 'video';
    const filename = generateSafeFilename(sanitizedTitle, format);

    // Download the video
    const filePath = await downloadVideo({
      videoId,
      url,
      format,
      outputPath: tempDir,
      filename: sanitizedTitle,
    });

    console.log(`[DOWNLOAD API] Download complete: ${filePath}`);

    // Stream the file to response
    const response = await streamFileToResponse(filePath, filename, format);

    // Schedule cleanup after a delay (to allow streaming to complete)
    // Note: In production, you might want a more robust cleanup mechanism
    setTimeout(() => {
      if (tempDir) {
        cleanupTempFiles(tempDir).catch((error) => {
          console.error('[DOWNLOAD API] Cleanup error:', error);
        });
      }
    }, 60000); // Cleanup after 1 minute

    return response;
  } catch (error: any) {
    console.error('[DOWNLOAD API] Error:', error);

    // Clean up temp directory on error
    if (tempDir) {
      await cleanupTempFiles(tempDir);
    }

    // Handle specific errors
    if (error.message?.includes('yt-dlp is not installed')) {
      return createErrorResponse(
        'yt-dlp is not installed on the server. Please install it: brew install yt-dlp',
        500
      );
    }

    if (error.message?.includes('timed out')) {
      return createErrorResponse('Download timed out. The video may be too large or unavailable.', 504);
    }

    if (error.message?.includes('Video unavailable')) {
      return createErrorResponse(
        'This video is unavailable. It may be private, deleted, or region-restricted.',
        404
      );
    }

    // Generic error
    return createErrorResponse(error.message || 'Failed to download video', 500);
  }
}
