"use client";

import { useEffect, type Dispatch } from "react";
import type { CourseStructure } from "@/lib/schema";
import { consumeSSE } from "@/lib/sse";
import type { AppState, Action } from "@/hooks/use-wizard-state";

export function useExtraction(state: AppState, dispatch: Dispatch<Action>): void {
  useEffect(() => {
    if (state.extractionTrigger === 0) return;
    if (!state.pdfFile || !state.anthropicKey) return;

    dispatch({ type: "EXTRACTION_STATUS", message: "Uploading PDF…" });

    // Client-side progress messages while Claude processes (60-90s typical)
    const msgs = [
      { delay: 3000, text: "Reading through the script… 📖" },
      { delay: 10000, text: "Identifying course structure…" },
      { delay: 25000, text: "Extracting lesson content… (this can take a minute)" },
      { delay: 45000, text: "Processing interactive elements…" },
      { delay: 70000, text: "Almost there — assembling the full course…" },
      { delay: 100000, text: "Still working — large modules take a bit longer…" },
    ];
    const timers = msgs.map(({ delay, text }) =>
      setTimeout(() => dispatch({ type: "EXTRACTION_STATUS", message: text }), delay)
    );

    const fd = new FormData();
    fd.append("pdf", state.pdfFile);

    fetch("/api/extract", {
      method: "POST",
      headers: { "x-anthropic-key": state.anthropicKey },
      body: fd,
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Extraction failed" })) as { error?: string };
          throw new Error(err.error ?? "Extraction failed");
        }

        const gotResult = await consumeSSE(res, {
          onProgress(message) {
            dispatch({ type: "EXTRACTION_STATUS", message });
          },
          onComplete(data) {
            timers.forEach(clearTimeout);
            dispatch({ type: "EXTRACTION_COMPLETE", course: data.course as CourseStructure });
          },
          onError(error) {
            timers.forEach(clearTimeout);
            dispatch({ type: "EXTRACTION_ERROR", error });
          },
        });

        if (!gotResult) {
          timers.forEach(clearTimeout);
          dispatch({
            type: "EXTRACTION_ERROR",
            error: "Connection closed before extraction completed. The model may have timed out — try again or use a smaller PDF.",
          });
        }
      })
      .catch((err: Error) => {
        timers.forEach(clearTimeout);
        dispatch({ type: "EXTRACTION_ERROR", error: err.message });
      });

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.extractionTrigger]);
}
