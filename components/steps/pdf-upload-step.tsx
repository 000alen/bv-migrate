"use client";

import { useState } from "react";
import { Dropzone } from "@/components/ui/dropzone";
import type { UploadMode } from "@/lib/types";

interface PdfUploadStepProps {
  onFile: (file: File, mode: UploadMode) => void;
}

const MAX_SIZE = 200 * 1024 * 1024; // 200 MB

export function PdfUploadStep({ onFile }: PdfUploadStepProps) {
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    const isZip = file.name.endsWith(".zip") || file.type === "application/zip" || file.type === "application/x-zip-compressed";
    const isPdf = file.name.endsWith(".pdf") || file.type === "application/pdf";

    if (!isPdf && !isZip) {
      setError("Please upload a PDF or Rise ZIP file.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum size is 200 MB.`);
      return;
    }
    setError(null);
    onFile(file, isZip ? "rise-zip" : "pdf");
  }

  return (
    <div className="animate-fade-in">
      <Dropzone
        accept=".pdf,application/pdf,.zip,application/zip"
        emoji="📄"
        title="Drop your PDF or Rise ZIP here or click to browse"
        subtitle="PDF script or Articulate Rise ZIP · max 200 MB"
        onFile={handleFile}
        error={error}
      />
    </div>
  );
}
