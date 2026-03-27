"use client";

import { useEffect, type Dispatch } from "react";
import type { ImportLog, ImportHistory, ImportProgressEvent } from "@/lib/types";
import { consumeSSE } from "@/lib/sse";
import type { AppState, Action } from "@/hooks/use-wizard-state";

export function useImport(state: AppState, dispatch: Dispatch<Action>): void {
  useEffect(() => {
    if (state.importTrigger === 0) return;
    if (!state.courseStructure || !state.circleToken) return;
    const spaceGroupId = parseInt(state.spaceGroupId, 10);
    if (isNaN(spaceGroupId)) return;

    // Build imageData from imageAssignments + zipImages
    const imageData: Record<number, { filename: string; dataUrl: string }> = {};
    for (const [idxStr, imgName] of Object.entries(state.imageAssignments)) {
      const idx = parseInt(idxStr, 10);
      const img = state.zipImages.find((z) => z.name === imgName);
      if (img) {
        imageData[idx] = { filename: img.name, dataUrl: img.dataUrl };
      }
    }

    fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        course: state.courseStructure,
        circleToken: state.circleToken,
        spaceGroupId,
        geniallyUrls: state.geniallyUrls,
        imageAssignments: state.imageAssignments,
        imageData: Object.keys(imageData).length > 0 ? imageData : undefined,
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Import request failed");
        await consumeSSE(res, {
          onProgress(_message, raw) {
            dispatch({ type: "IMPORT_PROGRESS", event: raw as unknown as ImportProgressEvent });
          },
          onComplete(data) {
            const log = data.log as ImportLog;
            try {
              const existing = JSON.parse(
                localStorage.getItem("bv_import_history") ?? "[]"
              ) as ImportHistory[];
              const newEntry: ImportHistory = {
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                courseName: log.courseName,
                spaceId: log.courseId,
                sectionCount: log.sections.length,
                lessonCount: log.sections.reduce((n, sec) => n + sec.lessons.length, 0),
                contentType: state.contentType ?? "module",
                contentNumber: state.contentNumber ?? 1,
              };
              existing.unshift(newEntry);
              localStorage.setItem("bv_import_history", JSON.stringify(existing.slice(0, 50)));
            } catch (e) {
              console.error("Failed to save import history:", e);
            }
            dispatch({ type: "IMPORT_COMPLETE", log });
          },
          onError(message, raw) {
            dispatch({
              type: "IMPORT_ERROR",
              error: message,
              partial: (raw.partial as ImportLog | null | undefined) ?? null,
            });
          },
        });
      })
      .catch((err: Error) => dispatch({ type: "IMPORT_ERROR", error: err.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.importTrigger]);
}
