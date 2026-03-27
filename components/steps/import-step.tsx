"use client";

import type { ProgressEvent, ImportLog } from "@/lib/types";

interface ImportStepProps {
  triggered: boolean;
  progress: ProgressEvent[];
  status: string;
  log: ImportLog | null;
  error: string | null;
  onTrigger: () => void;
  onRetry: () => void;
}

export function ImportStep({
  triggered,
  progress,
  status,
  log,
  error,
  onTrigger,
  onRetry,
}: ImportStepProps) {
  if (!triggered) {
    return (
      <div className="animate-fade-in rounded-xl border border-gray-200 bg-white p-6 shadow-sm text-center">
        <p className="text-sm text-gray-600 mb-4">
          Everything is ready. Click below to start importing to Circle.
        </p>
        <button
          onClick={onTrigger}
          className="h-11 px-8 rounded-xl text-sm font-semibold transition-colors"
          style={{ backgroundColor: "#CE99F2" }}
        >
          🏗️ Start Import
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-fade-in rounded-xl border border-red-200 bg-red-50 p-5">
        <p className="text-sm font-medium text-red-700 mb-1">Import failed</p>
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

  if (log) {
    return (
      <div className="animate-fade-in rounded-xl border border-green-200 bg-green-50 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-green-600 font-semibold text-sm">✓ Import complete!</span>
          <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
            ID: {log.courseId}
          </span>
        </div>
        <p className="text-xs text-green-700 font-medium">{log.courseName}</p>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {log.sections.map((section) => (
            <div key={section.id}>
              <p className="text-xs font-medium text-gray-700">📂 {section.name}</p>
              {section.lessons.map((lesson) => (
                <p key={lesson.id} className="text-xs text-gray-500 pl-4">
                  └ {lesson.name} (#{lesson.id})
                </p>
              ))}
            </div>
          ))}
        </div>
        <button
          onClick={() => {
            const blob = new Blob([JSON.stringify(log, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `import-log-${log.courseId}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 transition-colors"
        >
          ↓ Download log
        </button>
      </div>
    );
  }

  // In progress
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
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
