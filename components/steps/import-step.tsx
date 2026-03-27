"use client";

import { useState } from "react";
import type { ImportProgressEvent, ImportLog } from "@/lib/types";

interface ImportStepProps {
  triggered: boolean;
  progress: ImportProgressEvent[];
  status: string;
  log: ImportLog | null;
  error: string | null;
  partial: ImportLog | null;
  sectionCount: number;
  lessonCount: number;
  onTrigger: () => void;
  onRetry: () => void;
}

function ConfirmDialog({
  sectionCount,
  lessonCount,
  onConfirm,
  onCancel,
}: {
  sectionCount: number;
  lessonCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 space-y-4 m-4">
        <h3 className="font-semibold text-base">Ready to import?</h3>
        <p className="text-sm text-gray-600">
          This will create a new course in Circle with{" "}
          <strong>{sectionCount} section{sectionCount !== 1 ? "s" : ""}</strong> and{" "}
          <strong>{lessonCount} lesson{lessonCount !== 1 ? "s" : ""}</strong>. All content will be
          in draft mode. This cannot be easily undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: "#CE99F2" }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

export function ImportStep({
  triggered,
  progress,
  status,
  log,
  error,
  partial,
  sectionCount,
  lessonCount,
  onTrigger,
  onRetry,
}: ImportStepProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  if (!triggered) {
    return (
      <>
        <div className="animate-fade-in rounded-xl border border-gray-200 bg-white p-6 shadow-sm text-center">
          <p className="text-sm text-gray-600 mb-4">
            Everything is ready. Click below to start importing to Circle.
          </p>
          <button
            onClick={() => setShowConfirm(true)}
            className="h-11 px-8 rounded-xl text-sm font-semibold transition-colors"
            style={{ backgroundColor: "#CE99F2" }}
          >
            🏗️ Start Import
          </button>
        </div>
        {showConfirm && (
          <ConfirmDialog
            sectionCount={sectionCount}
            lessonCount={lessonCount}
            onConfirm={() => {
              setShowConfirm(false);
              onTrigger();
            }}
            onCancel={() => setShowConfirm(false)}
          />
        )}
      </>
    );
  }

  if (error) {
    return (
      <div className="animate-fade-in rounded-xl border border-red-200 bg-red-50 p-5 space-y-3">
        <div>
          <p className="text-sm font-medium text-red-700 mb-1">Import failed</p>
          <p className="text-xs text-red-600">{error}</p>
        </div>
        {partial && partial.courseId !== -1 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-xs font-medium text-amber-800 mb-1">
              ⚠️ Partial import — these resources were created and may need manual cleanup:
            </p>
            <p className="text-xs text-amber-700">
              Course ID: <strong>{partial.courseId}</strong> &ldquo;{partial.courseName}&rdquo;
            </p>
            {partial.sections.length > 0 && (
              <div className="mt-1 space-y-0.5 max-h-28 overflow-y-auto">
                {partial.sections.map((sec) => (
                  <p key={sec.id} className="text-xs text-amber-700 pl-2">
                    • {sec.name} (section #{sec.id}, {sec.lessons.length} lesson{sec.lessons.length !== 1 ? "s" : ""})
                  </p>
                ))}
              </div>
            )}
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(partial, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `partial-import-${partial.courseId}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="mt-2 text-xs font-medium px-2 py-1 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-800 transition-colors"
            >
              ↓ Download partial log
            </button>
          </div>
        )}
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
