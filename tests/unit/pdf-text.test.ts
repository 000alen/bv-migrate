import { describe, it, expect } from "vitest";
import { extractScriptTextFromPdf } from "@/lib/pdf-text";
import { TEST_PDF } from "../integration/helpers/test-pdf";

describe("extractScriptTextFromPdf", () => {
  it("extracts text from minimal PDF fixture", async () => {
    const { text, numPages, truncated } = await extractScriptTextFromPdf(TEST_PDF);
    expect(truncated).toBe(false);
    expect(numPages).toBeGreaterThanOrEqual(1);
    expect(text.toLowerCase()).toContain("integration");
  });
});
