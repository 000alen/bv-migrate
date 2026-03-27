"use client";

import { useRef, useState } from "react";

interface DropzoneProps {
  accept: string;
  emoji: string;
  title: string;
  subtitle: string;
  onFile: (file: File) => void;
  error?: string | null;
}

export function Dropzone({ accept, emoji, title, subtitle, onFile, error }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className="w-full rounded-xl border-2 border-dashed p-8 text-center transition-all"
        style={{ borderColor: dragging ? "var(--brand-purple)" : "#d1d5db" }}
      >
        <div className="flex flex-col items-center gap-2">
          <span className="text-3xl">{emoji}</span>
          <p className="text-sm font-medium text-black">{title}</p>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </>
  );
}
