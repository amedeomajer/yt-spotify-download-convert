"use client";
import * as React from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { DownloadFormat } from "@/lib/download/yt-dlp-config";

interface FormatSelectorProps {
  selectedFormat: DownloadFormat;
  onFormatChange: (format: DownloadFormat) => void;
  size?: "sm" | "default";
  className?: string;
}

export function FormatSelector({
  selectedFormat,
  onFormatChange,
  size = "default",
  className = "",
}: FormatSelectorProps) {
  const sizeClasses = {
    sm: "text-sm py-1 px-2",
    default: "text-base py-2 px-3",
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label
        htmlFor="format-select"
        className="text-sm font-medium text-muted-foreground"
      >
        Download as:
      </label>
      <Select>
        <SelectTrigger className="w-[180px]">
          <SelectValue>Select Format</SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-white w-[180px]">
          <SelectGroup>
            <SelectLabel>Fruits</SelectLabel>
            <SelectItem value="mp3">Audio (MP3)</SelectItem>
            <SelectItem value="m4a">Audio (M4A)</SelectItem>
            <SelectItem value="mp4">Video (MP4)</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      <select
        id="format-select"
        value={selectedFormat}
        onChange={(e) => onFormatChange(e.target.value as DownloadFormat)}
        className={`
          ${sizeClasses[size]}
          rounded-lg border border-border bg-background
          focus:outline-none focus:ring-2 focus:ring-ring
          cursor-pointer
        `}
      >
        <option value="mp3">Audio (MP3)</option>
        <option value="m4a">Audio (M4A)</option>
        <option value="mp4">Video (MP4)</option>
      </select>
    </div>
  );
}
