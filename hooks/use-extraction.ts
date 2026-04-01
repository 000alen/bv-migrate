"use client";

import { useEffect, type Dispatch } from "react";
import type { CourseStructure } from "@/lib/schema";
import { consumeSSE } from "@/lib/sse";
import type { AppState, Action } from "@/hooks/use-wizard-state";

export function useExtraction(state: AppState, dispatch: Dispatch<Action>): void {
  useEffect(() => {
    if (state.extractionTrigger === 0) return;
    if (!state.pdfFile) return;

    const isRiseZip = state.uploadMode === "rise-zip";

    if (!isRiseZip && !state.anthropicKey) return;

    dispatch({ type: "EXTRACTION_STATUS", message: isRiseZip ? "Reading ZIP…" : "Uploading PDF…" });

    // Client-side progress messages for PDF mode (60-90s typical)
    const msgs = isRiseZip
      ? []
      : [
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

    const controller = new AbortController();

    let fetchPromise: Promise<Response>;
    if (isRiseZip) {
      const fd = new FormData();
      fd.append("zip", state.pdfFile);
      fetchPromise = fetch("/api/extract-rise", {
        method: "POST",
        body: fd,
        signal: controller.signal,
      });
    } else {
      const fd = new FormData();
      fd.append("pdf", state.pdfFile);
      fetchPromise = fetch("/api/extract", {
        method: "POST",
        headers: { "x-anthropic-key": state.anthropicKey },
        body: fd,
        signal: controller.signal,
      });
    }

    fetchPromise
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
            dispatch({
              type: "EXTRACTION_COMPLETE",
              course: data.course as CourseStructure,
              imageData: data.imageData as Record<number, { filename: string; dataUrl: string }> | undefined,
            });
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
            error: isRiseZip
              ? "Connection closed before extraction completed."
              : "Connection closed before extraction completed. The model may have timed out — try again or use a smaller PDF.",
          });
        }
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        timers.forEach(clearTimeout);
        dispatch({ type: "EXTRACTION_ERROR", error: err.message });
      });

    return () => {
      timers.forEach(clearTimeout);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.extractionTrigger]);
}
