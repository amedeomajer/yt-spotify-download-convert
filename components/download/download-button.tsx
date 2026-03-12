"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { DownloadFormat } from '@/lib/download/yt-dlp-config';

interface DownloadButtonProps {
  videoId?: string;
  videoIds?: string[];
  url?: string;
  format: DownloadFormat;
  title?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'xs';
  disabled?: boolean;
  className?: string;
}

export function DownloadButton({
  videoId,
  videoIds,
  url,
  format,
  title,
  variant = 'outline',
  size = 'sm',
  disabled = false,
  className = '',
}: DownloadButtonProps) {
  const [downloading, setDownloading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      setError(null);
      setSuccess(false);

      // Determine if this is a single or batch download
      const isBatch = videoIds && videoIds.length > 1;

      if (isBatch) {
        // TODO: Implement batch download when Phase 3 is complete
        throw new Error('Batch download not yet implemented');
      }

      // Single video download
      const response = await fetch('/api/download/video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId,
          url,
          format,
          title,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Download failed');
      }

      // Get the blob from response
      const blob = await response.blob();

      // Create a download link
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;

      // Set filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `download.${format}`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
          filename = decodeURIComponent(filename);
        }
      } else if (title) {
        filename = `${title}.${format}`;
      }

      link.download = filename;

      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup
      window.URL.revokeObjectURL(downloadUrl);

      // Re-enable button immediately after download starts
      setDownloading(false);

      // Show success state
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err: any) {
      console.error('Download error:', err);
      setError(err.message);
      setDownloading(false); // Re-enable on error
      setTimeout(() => setError(null), 5000);
    }
  };

  // Determine button text
  let buttonText = '↓';
  if (downloading) {
    buttonText = '...';
  } else if (success) {
    buttonText = '✓';
  } else if (error) {
    buttonText = '✗';
  }

  return (
    <div className="relative">
      <Button
        onClick={handleDownload}
        disabled={disabled || downloading}
        variant={success ? 'default' : error ? 'destructive' : variant}
        size={size}
        className={className}
        title={error || 'Download'}
      >
        {downloading && <span className="animate-spin mr-1">⏳</span>}
        {buttonText}
      </Button>
      {error && (
        <div className="absolute top-full mt-1 left-0 text-xs text-red-500 whitespace-nowrap z-10">
          {error}
        </div>
      )}
    </div>
  );
}
