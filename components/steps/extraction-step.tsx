"use client";

import { Spinner } from "@/components/ui/spinner";

interface ExtractionStepProps {
  status: string;
  error: string | null;
  onRetry: () => void;
}

export function ExtractionStep({ status, error, onRetry }: ExtractionStepProps) {
  if (error) {
    return (
      <div className="animate-fade-in rounded-xl border border-red-200 bg-red-50 p-5">
        <p className="text-sm font-medium text-red-700 mb-1">Extraction failed</p>
        <pre className="text-xs text-red-600 mb-3 whitespace-pre-wrap break-words max-h-64 overflow-y-auto font-sans">
          {error}
        </pre>
        <button
          onClick={onRetry}
          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      {/* Skeleton course structure preview */}
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-1.5">
            {/* Section bar */}
            <div
              className="h-4 rounded-md bg-gray-200 animate-pulse"
              style={{ width: `${55 + i * 12}%` }}
            />
            {/* Lesson lines */}
            {[0, 1, ...(i < 2 ? [2] : [])].map((j) => (
              <div
                key={j}
                className="h-3 rounded ml-5 bg-gray-100 animate-pulse"
                style={{ width: `${38 + j * 13}%` }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Status message */}
      <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
        <Spinner className="h-4 w-4" />
        <p className="text-xs text-gray-500">
          {status || "Reading through the script…"}
        </p>
      </div>
    </div>
  );
}
