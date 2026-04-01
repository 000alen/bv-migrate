/**
 * Pre-load the pdf.js worker so the fake-worker setup never calls the
 * dynamic `import(this.workerSrc)` that Turbopack rewrites into a broken path.
 *
 * pdf.js checks `globalThis.pdfjsWorker?.WorkerMessageHandler` first;
 * when found, it skips the dynamic import entirely.
 */
// @ts-expect-error -- no .d.ts for the worker bundle; only needs WorkerMessageHandler export
import * as pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).pdfjsWorker ??= pdfjsWorker;

import { PDFParse } from "pdf-parse";

/** Hard cap to avoid blowing context on pathological PDFs (override via env). */
function maxTextChars(): number {
  const raw = process.env.BV_EXTRACT_MAX_TEXT_CHARS;
  if (raw === undefined || raw === "") return 1_200_000;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 1_200_000;
}

function normalizeWhitespace(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

/**
 * Extract plain text from a PDF buffer (fast, local). Scanned/image-only PDFs may return empty text.
 */
export async function extractScriptTextFromPdf(buffer: Buffer): Promise<{
  text: string;
  numPages: number;
  truncated: boolean;
}> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    let text = result.text ?? "";
    const numPages = result.total ?? 0;
    text = normalizeWhitespace(text);

    const cap = maxTextChars();
    let truncated = false;
    if (text.length > cap) {
      text = text.slice(0, cap);
      truncated = true;
    }

    return { text, numPages, truncated };
  } finally {
    await parser.destroy();
  }
}
