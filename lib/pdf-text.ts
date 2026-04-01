/**
 * pdf.js's worker bundle references DOMMatrix / ImageData / Path2D at load time.
 * On Vercel serverless these browser globals don't exist and the optional
 * @napi-rs/canvas polyfill isn't available. Stub them before importing the worker
 * — text extraction never touches rendering, so empty classes are safe.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;
if (typeof g.DOMMatrix === "undefined") {
  g.DOMMatrix = class DOMMatrix {
    constructor() { return Object.create(DOMMatrix.prototype); }
  };
}
if (typeof g.ImageData === "undefined") {
  g.ImageData = class ImageData {
    width = 0; height = 0; data = new Uint8ClampedArray(0);
    constructor(w: number, h: number) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); }
  };
}
if (typeof g.Path2D === "undefined") {
  g.Path2D = class Path2D {};
}

/**
 * Pre-load the pdf.js worker so the fake-worker setup never calls the
 * dynamic `import(this.workerSrc)` that Turbopack rewrites into a broken path.
 *
 * pdf.js checks `globalThis.pdfjsWorker?.WorkerMessageHandler` first;
 * when found, it skips the dynamic import entirely.
 */
// @ts-expect-error -- no .d.ts for the worker bundle; only needs WorkerMessageHandler export
import * as pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs";
g.pdfjsWorker ??= pdfjsWorker;

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
