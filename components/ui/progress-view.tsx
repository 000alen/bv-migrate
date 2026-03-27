import { Spinner } from "@/components/ui/spinner";

interface ProgressItem {
  step?: number;
  total?: number;
  message?: string;
}

interface ProgressViewProps {
  status: string;
  progress: ProgressItem[];
}

export function ProgressView({ status, progress }: ProgressViewProps) {
  const latest = progress[progress.length - 1];
  const pct =
    latest?.step != null && latest?.total
      ? Math.round((latest.step / latest.total) * 100)
      : 0;

  return (
    <div className="animate-fade-in rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
      <div className="flex items-center gap-3">
        <Spinner />
        <p className="text-sm text-gray-700 flex-1 truncate">{status || "Connecting…"}</p>
        {latest?.step != null && latest?.total && (
          <span className="text-xs text-gray-500 flex-shrink-0">
            {latest.step}/{latest.total}
          </span>
        )}
      </div>

      {latest?.total && (
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: "var(--brand-purple)" }}
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
