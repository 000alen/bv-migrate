import { extractText, getDocumentProxy } from "unpdf";

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
 * Extract plain text from a PDF buffer (fast, local, serverless-safe).
 * Uses `unpdf` which ships a serverless build of pdf.js — no native deps,
 * no DOMMatrix/canvas polyfills needed.
 */
export async function extractScriptTextFromPdf(buffer: Buffer): Promise<{
  text: string;
  numPages: number;
  truncated: boolean;
}> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { totalPages, text: rawText } = await extractText(pdf, {
    mergePages: true,
  });

  let text = normalizeWhitespace(rawText as string);

  const cap = maxTextChars();
  let truncated = false;
  if (text.length > cap) {
    text = text.slice(0, cap);
    truncated = true;
  }

  return { text, numPages: totalPages, truncated };
}
