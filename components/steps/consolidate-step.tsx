"use client";

import { useState, useEffect } from "react";
import type { ImportHistory, ConsolidateLog } from "@/lib/types";
import { consumeSSE } from "@/lib/sse";

interface ConsolidateSource {
  spaceId: number;
  label: string;
}

interface ConsolidateStepProps {
  circleToken: string;
  spaceGroupId: string;
  onComplete: (log: ConsolidateLog) => void;
  onError: (error: string) => void;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function ConsolidateStep({ circleToken, spaceGroupId, onComplete, onError }: ConsolidateStepProps) {
  const [history, setHistory] = useState<ImportHistory[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [manualEntries, setManualEntries] = useState<string>(""); // "spaceId:label" per line
  const [combinedName, setCombinedName] = useState("Foundation Year");
  const [status, setStatus] = useState<string>("");
  const [progress, setProgress] = useState<{ type: string; message?: string; step?: number; total?: number }[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [resultLog, setResultLog] = useState<ConsolidateLog | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("bv_import_history");
      if (stored) setHistory(JSON.parse(stored) as ImportHistory[]);
    } catch (e) {
      console.error("Failed to load import history:", e);
    }
  }, []);

  function toggleModule(spaceId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(spaceId)) next.delete(spaceId);
      else next.add(spaceId);
      return next;
    });
  }

  function buildSources(): ConsolidateSource[] {
    const sources: ConsolidateSource[] = [];
    // From history (in order of contentNumber)
    const fromHistory = history
      .filter((h) => selected.has(h.spaceId))
      .sort((a, b) => a.contentNumber - b.contentNumber);
    for (const h of fromHistory) {
      sources.push({
        spaceId: h.spaceId,
        label: `${h.contentType[0].toUpperCase() + h.contentType.slice(1)} ${h.contentNumber} — ${h.courseName}`,
      });
    }
    // From manual entries
    for (const line of manualEntries.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx === -1) {
        const id = parseInt(trimmed, 10);
        if (!isNaN(id)) sources.push({ spaceId: id, label: `Space ${id}` });
      } else {
        const id = parseInt(trimmed.slice(0, colonIdx).trim(), 10);
        const label = trimmed.slice(colonIdx + 1).trim();
        if (!isNaN(id) && label) sources.push({ spaceId: id, label });
      }
    }
    return sources;
  }

  async function handleStart() {
    const sources = buildSources();
    if (sources.length < 2) {
      alert("Please select at least 2 modules to combine.");
      return;
    }
    if (!combinedName.trim()) {
      alert("Please enter a name for the combined course.");
      return;
    }
    if (!circleToken || !spaceGroupId) {
      alert("Circle API token and Space Group ID are required. Please check Settings.");
      return;
    }
    const spaceGroupIdNum = parseInt(spaceGroupId, 10);
    if (isNaN(spaceGroupIdNum)) {
      alert("Invalid Space Group ID.");
      return;
    }

    setRunning(true);
    setProgress([]);
    setStatus("Starting consolidation...");

    try {
      const res = await fetch("/api/consolidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources,
          combinedName: combinedName.trim(),
          combinedSlug: slugify(combinedName.trim()),
          circleToken,
          spaceGroupId: spaceGroupIdNum,
        }),
      });

      if (!res.ok) throw new Error("Consolidation request failed");
      await consumeSSE(res, {
        onProgress(message, raw) {
          setProgress((p) => [...p, raw as { type: string; message?: string; step?: number; total?: number }]);
          setStatus(message);
        },
        onComplete(data) {
          const log = data.log as ConsolidateLog;
          setDone(true);
          setResultLog(log);
          onComplete(log);
        },
        onError(message) {
          onError(message);
          setRunning(false);
        },
      });
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  if (done && resultLog) {
    return (
      <div className="animate-fade-in rounded-xl border border-green-200 bg-green-50 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-green-600 font-semibold text-sm">✓ Consolidation complete!</span>
          <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
            ID: {resultLog.courseId}
          </span>
        </div>
        <p className="text-xs text-green-700 font-medium">{resultLog.courseName}</p>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {resultLog.sections.map((section) => (
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
            const blob = new Blob([JSON.stringify(resultLog, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `consolidate-log-${resultLog.courseId}.json`;
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

  if (running) {
    const latest = progress[progress.length - 1];
    const pct = latest?.step != null && latest?.total ? Math.round((latest.step / latest.total) * 100) : 0;
    return (
      <div className="animate-fade-in rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-3">
          <svg className="h-5 w-5 animate-spin text-[#CE99F2] flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-gray-700 flex-1 truncate">{status || "Connecting…"}</p>
          {latest?.step != null && latest?.total && (
            <span className="text-xs text-gray-500 flex-shrink-0">{latest.step}/{latest.total}</span>
          )}
        </div>
        {latest?.total && (
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: "#CE99F2" }} />
          </div>
        )}
        {progress.length > 1 && (
          <div className="max-h-28 overflow-y-auto space-y-0.5">
            {progress.slice(-8).map((p, i) => (
              <p key={i} className="text-xs text-gray-500">✓ {p.message}</p>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-5">
      {history.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Select modules to combine:</p>
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {history
              .slice()
              .sort((a, b) => a.contentNumber - b.contentNumber)
              .map((h) => (
                <label key={h.spaceId} className="flex items-start gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-[#CE99F2]"
                    checked={selected.has(h.spaceId)}
                    onChange={() => toggleModule(h.spaceId)}
                  />
                  <div>
                    <p className="text-sm text-gray-800 group-hover:text-black">
                      {h.contentType[0].toUpperCase() + h.contentType.slice(1)} {h.contentNumber} — {h.courseName}
                    </p>
                    <p className="text-xs text-gray-400">
                      Space #{h.spaceId} · {h.sectionCount} sections · {h.lessonCount} lessons ·{" "}
                      {new Date(h.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </label>
              ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-gray-700 mb-1">
          Additional space IDs (one per line, format: <code className="text-xs bg-gray-100 px-1 rounded">12345:Module 3 — Title</code>):
        </p>
        <textarea
          className="w-full border border-gray-200 rounded-lg p-2 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-[#CE99F2]"
          rows={3}
          placeholder={"12345:Module 3 — Strategy\n67890:Module 4 — Finance"}
          value={manualEntries}
          onChange={(e) => setManualEntries(e.target.value)}
        />
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-1">Combined course name:</p>
        <input
          type="text"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#CE99F2]"
          value={combinedName}
          onChange={(e) => setCombinedName(e.target.value)}
        />
      </div>

      <button
        onClick={handleStart}
        className="h-11 w-full rounded-xl text-sm font-semibold transition-colors"
        style={{ backgroundColor: "#CE99F2" }}
      >
        📚 Combine Modules
      </button>
    </div>
  );
}
