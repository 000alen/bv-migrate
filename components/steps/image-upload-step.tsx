"use client";

import { useState } from "react";
import JSZip from "jszip";
import type { ZipImage } from "@/lib/types";
import { Spinner } from "@/components/ui/spinner";
import { Dropzone } from "@/components/ui/dropzone";

interface ImageUploadStepProps {
  onImages: (images: ZipImage[]) => void;
}

const IMAGE_EXTS = /\.(jpe?g|png|gif|webp|svg)$/i;

export function ImageUploadStep({ onImages }: ImageUploadStepProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setLoading(true);
    try {
      const zip = await JSZip.loadAsync(file);
      const images: ZipImage[] = [];

      for (const [path, entry] of Object.entries(zip.files)) {
        if (entry.dir || !IMAGE_EXTS.test(path)) continue;
        const blob = await entry.async("blob");
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        const name = path.split("/").pop() ?? path;
        images.push({ name, dataUrl });
      }

      if (images.length === 0) {
        setError("No image files found in the ZIP.");
        setLoading(false);
        return;
      }

      onImages(images);
    } catch (e) {
      console.error("ZIP extraction failed:", e);
      setError("Failed to read ZIP file.");
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-in">
      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex items-center gap-3">
          <Spinner />
          <p className="text-sm text-gray-700">Extracting images from ZIP…</p>
        </div>
      ) : (
        <Dropzone
          accept=".zip,application/zip"
          emoji="📁"
          title="Drop your ZIP folder here or click to browse"
          subtitle="ZIP archive containing image files"
          onFile={handleFile}
          error={error}
        />
      )}
    </div>
  );
}
