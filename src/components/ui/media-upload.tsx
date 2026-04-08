"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/3gpp",
];

const VIDEO_TYPES = ["video/mp4", "video/3gpp"];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 600 * 1024; // 600KB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface MediaUploadProps {
  onUpload: (url: string) => void;
  onRemove: () => void;
  value?: string;
  compact?: boolean;
  className?: string;
}

export function MediaUpload({
  onUpload,
  onRemove,
  value,
  compact = false,
  className,
}: MediaUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<{
    url: string;
    type: string;
    name: string;
    size: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Invalid file type. Allowed: JPG, PNG, GIF, WebP, MP4, 3GP`;
    }
    const isVideo = VIDEO_TYPES.includes(file.type);
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    const maxLabel = isVideo ? "600KB" : "5MB";
    if (file.size > maxSize) {
      return `File too large (${formatBytes(file.size)}). ${isVideo ? "Video" : "Image"} max: ${maxLabel}`;
    }
    return null;
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError("");
      setUploading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Upload failed");
        }

        setPreview({
          url: data.url,
          type: file.type,
          name: file.name,
          size: file.size,
        });
        onUpload(data.url);
      } catch (err: any) {
        setError(err.message || "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [onUpload, validateFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
      // Reset so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [uploadFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleRemove = useCallback(() => {
    setPreview(null);
    setError("");
    onRemove();
  }, [onRemove]);

  const isVideo = preview?.type ? VIDEO_TYPES.includes(preview.type) : false;
  const hasMedia = !!(value || preview);

  // If media is attached, show preview
  if (hasMedia) {
    const displayUrl = preview?.url || value || "";
    const displayIsVideo = preview
      ? isVideo
      : displayUrl.match(/\.(mp4|3gp|3gpp)$/i) !== null;

    return (
      <div className={cn("space-y-2", className)}>
        <div className="relative inline-block">
          {displayIsVideo ? (
            <video
              src={displayUrl}
              controls
              className="max-h-40 rounded-lg border"
            />
          ) : (
            <img
              src={displayUrl}
              alt="Attached media"
              className="max-h-40 rounded-lg border object-contain"
            />
          )}
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs font-bold shadow hover:bg-destructive/90"
            title="Remove attachment"
          >
            X
          </button>
        </div>
        {preview && (
          <p className="text-xs text-muted-foreground">
            {preview.name} ({formatBytes(preview.size)})
          </p>
        )}
      </div>
    );
  }

  // Compact mode: just a button trigger (for inline use in inbox/contacts)
  if (compact) {
    return (
      <div className={cn("inline-flex flex-col", className)}>
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Attach media (MMS)"
        >
          {uploading ? (
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Uploading
            </span>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          )}
        </Button>
        {error && (
          <p className="text-xs text-destructive mt-1 max-w-48">{error}</p>
        )}
      </div>
    );
  }

  // Full drag-and-drop zone (for campaign compose)
  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        onChange={handleFileSelect}
        className="hidden"
      />
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
          uploading && "pointer-events-none opacity-60"
        )}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Uploading...</p>
          </div>
        ) : (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground mb-2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="text-sm text-muted-foreground">
              Drag and drop an image or video, or{" "}
              <span className="text-primary font-medium">click to browse</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              JPG, PNG, GIF, WebP (max 5MB) or MP4, 3GP (max 600KB)
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2 text-xs text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
