"use client";

import { useState } from "react";
import type { ImportProgressEvent, ImportLog } from "@/lib/types";
import { ConfirmDialog } from "./confirm-dialog";
import { ProgressView } from "./progress-view";
import { ErrorView, SuccessView } from "./result-view";

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
    return <ErrorView error={error} partial={partial} onRetry={onRetry} />;
  }

  if (log) {
    return <SuccessView log={log} />;
  }

  return <ProgressView status={status} progress={progress} />;
}
