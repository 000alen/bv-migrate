"use client";

import { useRef, useState } from "react";
import JSZip from "jszip";
import type { ZipImage } from "@/lib/types";

interface ImageUploadStepProps {
  onImages: (images: ZipImage[]) => void;
}

const IMAGE_EXTS = /\.(jpe?g|png|gif|webp|svg)$/i;

export function ImageUploadStep({ onImages }: ImageUploadStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
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

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="animate-fade-in">
      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex items-center gap-3">
          <svg
            className="h-5 w-5 animate-spin text-[#CE99F2]"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-gray-700">Extracting images from ZIP…</p>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className="w-full rounded-xl border-2 border-dashed p-8 text-center transition-all"
            style={{ borderColor: dragging ? "#CE99F2" : "#d1d5db" }}
          >
            <div className="flex flex-col items-center gap-2">
              <span className="text-3xl">📁</span>
              <p className="text-sm font-medium text-black">Drop your ZIP folder here or click to browse</p>
              <p className="text-xs text-gray-500">ZIP archive containing image files</p>
            </div>
          </button>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </>
      )}
    </div>
  );
}
