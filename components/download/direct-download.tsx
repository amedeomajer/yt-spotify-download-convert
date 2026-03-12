"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormatSelector } from "./format-selector";
import { parseYouTubeUrl, getUrlDescription } from "@/lib/download/url-parser";
import type { DownloadFormat } from "@/lib/download/yt-dlp-config";

export function DirectDownload() {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<DownloadFormat>("mp3");
  const [downloading, setDownloading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      setError(null);
      setSuccess(false);

      // Validate and parse URL
      const parsed = parseYouTubeUrl(url);
      if (!parsed) {
        throw new Error(
          "Invalid YouTube URL. Please enter a valid YouTube video or playlist link."
        );
      }

      // For now, only support single videos (playlists will come in Phase 5)
      if (parsed.type === "playlist") {
        throw new Error(
          "Playlist downloads coming soon! For now, please use individual video URLs."
        );
      }

      console.log(
        `[Direct Download] Downloading: ${getUrlDescription(parsed)}`
      );

      // Call download API
      const response = await fetch("/api/download/video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: parsed.url,
          format,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Download failed");
      }

      // Get the blob from response
      const blob = await response.blob();

      // Create a download link
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;

      // Set filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `download.${format}`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(
          /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
        );
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, "");
          filename = decodeURIComponent(filename);
        }
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
      setTimeout(() => {
        setSuccess(false);
        setUrl(""); // Clear URL after successful download
      }, 3000);
    } catch (err: any) {
      console.error("Download error:", err);
      setError(err.message);
      setDownloading(false); // Re-enable on error
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && url.trim() && !downloading) {
      handleDownload();
    }
  };

  return (
    <Card className="">
      <CardHeader className="h-full py-3 shadow-md">
        <CardTitle>Download from YouTube</CardTitle>
        <CardDescription>
          Paste any YouTube video link to download it as audio or video
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3">
          <label htmlFor="youtube-url" className="text-sm font-medium ">
            YouTube URL
          </label>
          <input
            id="youtube-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring max-w-96"
            disabled={downloading}
          />
        </div>

        <FormatSelector selectedFormat={format} onFormatChange={setFormat} />

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-600 dark:text-green-400">
            ✓ Download complete! Check your downloads folder.
          </div>
        )}

        <Button
          onClick={handleDownload}
          disabled={!url.trim() || downloading}
          className="w-full"
          size="lg"
        >
          {downloading ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              Downloading...
            </>
          ) : (
            <>↓ Download</>
          )}
        </Button>

        <div className="text-xs text-muted-foreground text-center">
          No authentication required • Downloads directly from YouTube
        </div>
      </CardContent>
    </Card>
  );
}
