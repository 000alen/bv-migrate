import type { ImportProgressEvent } from "@/lib/types";

interface ProgressViewProps {
  status: string;
  progress: ImportProgressEvent[];
}

export function ProgressView({ status, progress }: ProgressViewProps) {
  const latest = progress[progress.length - 1];
  const pct = latest ? Math.round((latest.step / latest.total) * 100) : 0;

  return (
    <div className="animate-fade-in rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
      <div className="flex items-center gap-3">
        <svg
          className="h-5 w-5 animate-spin text-[#CE99F2] flex-shrink-0"
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
        <p className="text-sm text-gray-700 flex-1 truncate">{status || "Connecting…"}</p>
        {latest && (
          <span className="text-xs text-gray-500 flex-shrink-0">
            {latest.step}/{latest.total}
          </span>
        )}
      </div>

      {latest && (
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: "#CE99F2" }}
          />
        </div>
      )}

      {progress.length > 1 && (
        <div className="max-h-28 overflow-y-auto space-y-0.5">
          {progress.slice(-8).map((p, i) => (
            <p key={i} className="text-xs text-gray-500">
              ✓ {p.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
