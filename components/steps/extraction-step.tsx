"use client";

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
        <p className="text-xs text-red-600 mb-3">{error}</p>
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
    <div className="animate-fade-in rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <svg
          className="h-5 w-5 animate-spin text-[#CE99F2]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <p className="text-sm text-gray-700">{status || "Starting extraction…"}</p>
      </div>
    </div>
  );
}
