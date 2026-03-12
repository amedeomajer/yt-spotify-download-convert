import { mkdir, rm, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

/**
 * Create a unique temporary directory for downloads
 * Returns the path to the created directory
 */
export async function createTempDir(): Promise<string> {
  const tempBase = tmpdir();
  const uniqueDir = `ytb-download-${randomUUID()}`;
  const tempDir = join(tempBase, uniqueDir);

  await mkdir(tempDir, { recursive: true });
  console.log(`[TEMP] Created temp directory: ${tempDir}`);

  return tempDir;
}

/**
 * Clean up temporary files and directories
 * Recursively deletes the directory and all its contents
 */
export async function cleanupTempFiles(dirPath: string): Promise<void> {
  try {
    await rm(dirPath, { recursive: true, force: true });
    console.log(`[TEMP] Cleaned up: ${dirPath}`);
  } catch (error) {
    console.error(`[TEMP] Failed to cleanup ${dirPath}:`, error);
    // Don't throw - cleanup failures shouldn't break the flow
  }
}

/**
 * Sanitize a filename to remove special characters and prevent path traversal
 */
export function sanitizeFilename(filename: string): string {
  return (
    filename
      // Remove or replace invalid characters
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      // Replace multiple spaces with single space
      .replace(/\s+/g, ' ')
      // Replace multiple underscores with single underscore
      .replace(/_+/g, '_')
      // Trim whitespace and special characters from ends
      .trim()
      // Limit length (max 200 chars for filename)
      .slice(0, 200)
  );
}

/**
 * Get file size in bytes
 */
export async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await stat(filePath);
    return stats.size;
  } catch (error) {
    console.error(`[TEMP] Failed to get file size for ${filePath}:`, error);
    return 0;
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Extract filename from a full path
 */
export function getFilenameFromPath(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1];
}
