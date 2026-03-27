"use client";

import { useRef, useState } from "react";

interface PdfUploadStepProps {
  onFile: (file: File) => void;
}

export function PdfUploadStep({ onFile }: PdfUploadStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFile(file: File) {
    if (file.type !== "application/pdf") return;
    onFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="animate-fade-in">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className="w-full rounded-xl border-2 border-dashed p-8 text-center transition-all"
        style={{
          borderColor: dragging ? "#CE99F2" : "#d1d5db",
          backgroundColor: dragging ? "#CE99F2/5" : "white",
        }}
      >
        <div className="flex flex-col items-center gap-2">
          <span className="text-3xl">📄</span>
          <p className="text-sm font-medium text-black">
            Drop your PDF here or click to browse
          </p>
          <p className="text-xs text-gray-500">PDF files only</p>
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
