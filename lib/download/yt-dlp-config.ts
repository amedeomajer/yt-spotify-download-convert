// Configuration for yt-dlp download functionality
// All values can be overridden via environment variables

export const YTDLP_CONFIG = {
  // Path to yt-dlp binary
  binaryPath: process.env.YTDLP_BINARY_PATH || 'yt-dlp',

  // Maximum file size in bytes (default: 500MB)
  maxFileSize: parseInt(process.env.YTDLP_MAX_FILE_SIZE || '524288000', 10),

  // Download timeout in milliseconds (default: 5 minutes)
  timeout: parseInt(process.env.YTDLP_TIMEOUT || '300000', 10),

  // Rate limiting configuration
  rateLimitMaxDownloads: parseInt(process.env.YTDLP_RATE_LIMIT_MAX || '50', 10),
  rateLimitWindow: parseInt(process.env.YTDLP_RATE_LIMIT_WINDOW || '3600000', 10), // 1 hour

  // Maximum concurrent downloads per user
  maxConcurrentDownloads: parseInt(process.env.YTDLP_MAX_CONCURRENT || '2', 10),

  // Supported formats
  audioFormats: ['mp3', 'm4a'] as const,
  videoFormats: ['mp4'] as const,

  // Audio quality for MP3 (kbps)
  audioQuality: '192',
} as const;

// Export types for supported formats
export type AudioFormat = typeof YTDLP_CONFIG.audioFormats[number];
export type VideoFormat = typeof YTDLP_CONFIG.videoFormats[number];
export type DownloadFormat = AudioFormat | VideoFormat;

// Helper to check if format is audio
export function isAudioFormat(format: DownloadFormat): format is AudioFormat {
  return YTDLP_CONFIG.audioFormats.includes(format as AudioFormat);
}

// Helper to check if format is video
export function isVideoFormat(format: DownloadFormat): format is VideoFormat {
  return YTDLP_CONFIG.videoFormats.includes(format as VideoFormat);
}

// Export individual constants for convenience
export const MAX_FILE_SIZE = YTDLP_CONFIG.maxFileSize;
export const DOWNLOAD_TIMEOUT = YTDLP_CONFIG.timeout;
export const RATE_LIMIT_MAX_DOWNLOADS = YTDLP_CONFIG.rateLimitMaxDownloads;
export const RATE_LIMIT_WINDOW = YTDLP_CONFIG.rateLimitWindow;
export const MAX_CONCURRENT_DOWNLOADS = YTDLP_CONFIG.maxConcurrentDownloads;
