import type { ImportLog } from "@/lib/types";

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface ErrorViewProps {
  error: string;
  partial: ImportLog | null;
  onRetry: () => void;
}

export function ErrorView({ error, partial, onRetry }: ErrorViewProps) {
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
                  • {sec.name} (section #{sec.id},{" "}
                  {sec.lessons.length} lesson{sec.lessons.length !== 1 ? "s" : ""})
                </p>
              ))}
            </div>
          )}
          <button
            onClick={() =>
              downloadJson(partial, `partial-import-${partial.courseId}.json`)
            }
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

interface SuccessViewProps {
  log: ImportLog;
}

export function SuccessView({ log }: SuccessViewProps) {
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
        onClick={() => downloadJson(log, `import-log-${log.courseId}.json`)}
        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 transition-colors"
      >
        ↓ Download log
      </button>
    </div>
  );
}
