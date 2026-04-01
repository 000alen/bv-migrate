/**
 * Full pipeline: Module 2 Script.pdf → /api/extract → /api/import → Circle.
 *
 * Run (from repo root, requires Module 2 Script.pdf and API access):
 *   RUN_E2E_MODULE2=1 ANTHROPIC_KEY=... CIRCLE_TOKEN=... SPACE_GROUP_ID=1006001 \
 *     pnpm exec vitest run --config vitest.config.integration.ts tests/integration/e2e-module2-import.test.ts
 */

import { describe, it, expect, afterAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { NextRequest } from "next/server";
import { POST as extractPost } from "@/app/api/extract/route";
import { POST as importPost } from "@/app/api/import/route";
import { collectSSEEvents, findEvent } from "./helpers/sse-utils";
import type { CourseStructure } from "@/lib/schema";
import type { ImportLog } from "@/lib/types";
import { BASE_URL, authHeaders } from "@/lib/circle";

const RUN = process.env.RUN_E2E_MODULE2 === "1";
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY ?? "";
const CIRCLE_TOKEN = process.env.CIRCLE_TOKEN ?? "";
const SPACE_GROUP_ID = parseInt(process.env.SPACE_GROUP_ID ?? "0", 10);

describe.skipIf(!RUN)("E2E: Module 2 PDF → Circle import", () => {
  let createdSpaceId: number | null = null;

  afterAll(async () => {
    if (!createdSpaceId || !CIRCLE_TOKEN) return;
    const res = await fetch(`${BASE_URL}/spaces/${createdSpaceId}`, {
      method: "DELETE",
      headers: authHeaders(CIRCLE_TOKEN, "DELETE"),
    });
    if (!res.ok && res.status !== 404) {
      console.warn(
        `[e2e] cleanup DELETE /spaces/${createdSpaceId} → ${res.status}`
      );
    } else {
      console.log(`[e2e] cleaned up space ${createdSpaceId}`);
    }
  });

  it(
    "extracts Module 2 Script.pdf and imports to Circle",
    async () => {
      if (!ANTHROPIC_KEY || !CIRCLE_TOKEN || SPACE_GROUP_ID <= 0) {
        throw new Error(
          "Set ANTHROPIC_KEY, CIRCLE_TOKEN, SPACE_GROUP_ID for e2e import"
        );
      }

      const pdfPath = join(process.cwd(), "Module 2 Script.pdf");
      const buf = readFileSync(pdfPath);
      const file = new File([buf], "Module 2 Script.pdf", {
        type: "application/pdf",
      });
      const fd = new FormData();
      fd.append("pdf", file);

      console.log("[e2e] starting extract…");
      const extractReq = new NextRequest("http://localhost/api/extract", {
        method: "POST",
        headers: {
          "x-llm-provider": "anthropic",
          "x-anthropic-key": ANTHROPIC_KEY,
        },
        body: fd,
      });
      const extractRes = await extractPost(extractReq);
      expect(extractRes.status).toBe(200);

      const extractEvents = await collectSSEEvents(extractRes);
      const extractErr = findEvent(extractEvents, "error");
      if (extractErr) {
        console.error("[e2e] extract error event:", JSON.stringify(extractErr, null, 2));
      }
      expect(extractErr, "extract should not error").toBeUndefined();

      const complete = findEvent(extractEvents, "complete");
      expect(complete?.course).toBeDefined();
      const course = complete!.course as CourseStructure;

      const uniqueCourse: CourseStructure = {
        ...course,
        name: `[E2E] ${course.name}`,
        slug: `${course.slug}-e2e-${Date.now()}`,
      };

      console.log("[e2e] extract ok, importing…", {
        name: uniqueCourse.name,
        slug: uniqueCourse.slug,
        sections: uniqueCourse.sections.length,
      });

      const importReq = new NextRequest("http://localhost/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course: uniqueCourse,
          circleToken: CIRCLE_TOKEN,
          spaceGroupId: SPACE_GROUP_ID,
          geniallyUrls: {},
        }),
      });
      const importRes = await importPost(importReq);
      expect(importRes.status).toBe(200);

      const importEvents = await collectSSEEvents(importRes);
      const importErr = findEvent(importEvents, "error");
      if (importErr) {
        console.error("[e2e] import error event:", JSON.stringify(importErr, null, 2));
      }
      expect(importErr, "import should not error").toBeUndefined();

      const importComplete = findEvent(importEvents, "complete");
      expect(importComplete?.log).toBeDefined();
      const log = importComplete!.log as ImportLog;
      createdSpaceId = log.courseId;

      expect(log.courseId).toBeGreaterThan(0);
      expect(log.sections.length).toBeGreaterThan(0);
      console.log("[e2e] import ok", {
        courseId: log.courseId,
        sections: log.sections.length,
        lessons: log.sections.reduce((n, s) => n + s.lessons.length, 0),
      });
    },
    600_000
  );
});
