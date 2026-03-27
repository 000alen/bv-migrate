"use client";

import { useState } from "react";
import { Dropzone } from "@/components/ui/dropzone";

interface PdfUploadStepProps {
  onFile: (file: File) => void;
}

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

export function PdfUploadStep({ onFile }: PdfUploadStepProps) {
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      setError("Please upload a PDF file.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum size is 50 MB.`);
      return;
    }
    setError(null);
    onFile(file);
  }

  return (
    <div className="animate-fade-in">
      <Dropzone
        accept=".pdf,application/pdf"
        emoji="📄"
        title="Drop your PDF here or click to browse"
        subtitle="PDF files only · max 50 MB"
        onFile={handleFile}
        error={error}
      />
    </div>
  );
}
