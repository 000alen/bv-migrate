/**
 * Minimal valid PDF-1.4 Buffer for integration testing the extract route.
 *
 * Built entirely from raw strings — no external PDF library required.
 * The xref byte offsets are calculated at runtime so the file is structurally
 * valid. Anthropic's document processing should be able to read the embedded text.
 *
 * Known text content (for snapshot verification):
 *   "Module 1 - TEST: Integration"
 *   "Section: Test Section"
 *   "Lesson: Test Lesson"
 */

function escapePdfStr(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function makeTestPdf(): Buffer {
  const lines = [
    "Module 1 - TEST: Integration",
    "Section: Test Section",
    "Lesson: Test Lesson",
    "This is integration test content for the extract route.",
  ];

  // Build page stream: one line per text entry, spaced vertically
  const streamParts = lines.map((line, i) => {
    const y = 720 - i * 20;
    return `BT /F1 12 Tf 72 ${y} Td (${escapePdfStr(line)}) Tj ET`;
  });
  const streamBody = streamParts.join("\n");
  const streamLen = Buffer.byteLength(streamBody, "utf-8");

  // Object definitions
  const obj1 = "1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n";
  const obj2 = "2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n";
  const obj3 =
    "3 0 obj\n" +
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]" +
    "/Contents 4 0 R" +
    "/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>>>\n" +
    "endobj\n";
  const obj4 =
    `4 0 obj\n<</Length ${streamLen}>>\nstream\n` +
    streamBody +
    `\nendstream\nendobj\n`;

  // Compute xref byte offsets
  const header = "%PDF-1.4\n";
  const off1 = header.length;
  const off2 = off1 + Buffer.byteLength(obj1, "utf-8");
  const off3 = off2 + Buffer.byteLength(obj2, "utf-8");
  const off4 = off3 + Buffer.byteLength(obj3, "utf-8");

  const body = header + obj1 + obj2 + obj3 + obj4;
  const bodyLen = Buffer.byteLength(body, "utf-8");

  const pad = (n: number) => String(n).padStart(10, "0");
  const xref =
    "xref\n" +
    "0 5\n" +
    `0000000000 65535 f \n` +
    `${pad(off1)} 00000 n \n` +
    `${pad(off2)} 00000 n \n` +
    `${pad(off3)} 00000 n \n` +
    `${pad(off4)} 00000 n \n`;
  const trailer =
    `trailer\n<</Size 5/Root 1 0 R>>\nstartxref\n${bodyLen}\n%%EOF\n`;

  return Buffer.from(body + xref + trailer, "utf-8");
}

/** Pre-built PDF Buffer. Import this constant directly in tests. */
export const TEST_PDF: Buffer = makeTestPdf();

/**
 * Wrap the PDF Buffer in a File object (Web API) for use with FormData.
 * Compatible with NextRequest / the extract route handler.
 */
export function makePdfFile(name = "test-module.pdf"): File {
  return new File([TEST_PDF], name, { type: "application/pdf" });
}
