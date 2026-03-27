"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CourseStructure } from "@/lib/schema";
import { FileText, Upload, Loader2, AlertCircle } from "lucide-react";

interface PdfUploadProps {
  anthropicKey: string;
  onExtracted: (course: CourseStructure) => void;
}

export function PdfUpload({ anthropicKey, onExtracted }: PdfUploadProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [isExtracting, setIsExtracting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    if (f.type === "application/pdf" || f.name.endsWith(".pdf")) {
      setFile(f);
      setError(null);
    } else {
      setError("Please upload a PDF file.");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function handleExtract() {
    if (!file || !anthropicKey) return;
    setIsExtracting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("pdf", file);
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "x-anthropic-key": anthropicKey },
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const course: CourseStructure = await res.json();
      onExtracted(course);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsExtracting(false);
    }
  }

  const canExtract = !!file && !!anthropicKey && !isExtracting;

  return (
    <div className="space-y-4">
      <Card
        className={[
          "border-2 border-dashed cursor-pointer transition-colors",
          isDragging ? "border-black bg-black/5" : "border-black/20 hover:border-black/40",
        ].join(" ")}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
          <div className="rounded-full bg-black/5 p-4">
            {file ? (
              <FileText className="h-8 w-8 text-black" />
            ) : (
              <Upload className="h-8 w-8 text-black/40" />
            )}
          </div>
          {file ? (
            <div className="text-center">
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-black/50">
                {(file.size / 1024 / 1024).toFixed(2)} MB — click to change
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="font-medium">Drop PDF here or click to browse</p>
              <p className="text-sm text-black/50">Module Script PDF</p>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!anthropicKey && (
        <p className="text-sm text-black/50 text-center">
          Set your Anthropic API key in the sidebar to enable extraction.
        </p>
      )}

      <Button
        onClick={handleExtract}
        disabled={!canExtract}
        className="w-full"
        size="lg"
      >
        {isExtracting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Extracting content with Claude...
          </>
        ) : (
          <>
            <FileText className="h-4 w-4" />
            Extract Content
          </>
        )}
      </Button>

      {isExtracting && (
        <p className="text-xs text-black/50 text-center">
          This may take 30–120 seconds depending on PDF length.
        </p>
      )}
    </div>
  );
}
