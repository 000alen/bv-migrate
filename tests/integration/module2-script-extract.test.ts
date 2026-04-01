/**
 * One-off diagnostic: extracts real "Module 2 Script.pdf" from repo root.
 * Requires ANTHROPIC_KEY. Slow; costs API tokens.
 *
 * Run: RUN_MODULE2_PDF=1 ANTHROPIC_KEY=... pnpm exec vitest run --config vitest.config.integration.ts tests/integration/module2-script-extract.test.ts
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/extract/route";
import { collectSSEEvents, findEvent } from "./helpers/sse-utils";

const KEY = process.env.ANTHROPIC_KEY;
const RUN = process.env.RUN_MODULE2_PDF === "1";

describe.skipIf(!RUN)("Module 2 Script PDF (diagnostic)", () => {
  it(
    "runs extract route against Module 2 Script.pdf",
    async () => {
      if (!KEY) {
        throw new Error("Set ANTHROPIC_KEY and RUN_MODULE2_PDF=1 to run this test");
      }
      const pdfPath = join(process.cwd(), "Module 2 Script.pdf");
      const buf = readFileSync(pdfPath);
      const file = new File([buf], "Module 2 Script.pdf", {
        type: "application/pdf",
      });
      const formData = new FormData();
      formData.append("pdf", file);

      const req = new NextRequest("http://localhost/api/extract", {
        method: "POST",
        headers: {
          "x-llm-provider": "anthropic",
          "x-anthropic-key": KEY,
        },
        body: formData,
      });

      const response = await POST(req);
      expect(response.status).toBe(200);

      const events = await collectSSEEvents(response);
      const errorEvent = findEvent(events, "error");
      const completeEvent = findEvent(events, "complete");

      if (errorEvent) {
        // eslint-disable-next-line no-console -- diagnostic output
        console.error("Extract error event:", JSON.stringify(errorEvent, null, 2));
      }
      expect(errorEvent, "expected success but got error event").toBeUndefined();
      expect(completeEvent).toBeDefined();
    },
    600_000
  );
});
