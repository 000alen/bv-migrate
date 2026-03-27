/**
 * Integration tests: image upload via Circle's direct_uploads API.
 *
 * Tests the full image pipeline:
 * 1. direct_uploads API → get presigned URL + signed_id
 * 2. PUT image bytes to presigned URL
 * 3. Import a course with imageData containing the test image
 * 4. Verify the signed_id appears in the import log
 * 5. Verify the lesson body_html contains the signed_id reference
 *
 * Also tests the direct_uploads + uploadFile functions in isolation.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/import/route";
import { CircleTestClient } from "./helpers/circle-test-client";
import { collectSSEEvents, findEvent } from "./helpers/sse-utils";
import { CIRCLE_TOKEN, SPACE_GROUP_ID, TEST_PREFIX } from "./config";
import { TEST_PNG, testPngDataUrl, md5Base64 } from "./helpers/test-image";
import {
  createDirectUpload,
  uploadFile,
} from "@/lib/circle";
import type { ImportLog } from "@/lib/types";

const TIMESTAMP = Date.now();

// ── Direct upload API (isolated) ──────────────────────────────────────────

describe("Circle direct_uploads API", () => {
  it("createDirectUpload returns a signed_id and presigned URL", async () => {
    const checksum = md5Base64(TEST_PNG);
    const result = await createDirectUpload(
      CIRCLE_TOKEN,
      "test-image.png",
      TEST_PNG.length,
      "image/png",
      checksum
    );

    expect(result.signed_id).toBeDefined();
    expect(typeof result.signed_id).toBe("string");
    expect(result.signed_id.length).toBeGreaterThan(0);
    // signed_id format is eyJ... (Rails MessageVerifier)
    expect(result.signed_id).toMatch(/^eyJ/);

    expect(result.direct_upload).toBeDefined();
    expect(result.direct_upload.url).toBeDefined();
    expect(typeof result.direct_upload.url).toBe("string");
    expect(result.direct_upload.url).toMatch(/^https?:\/\//);

    expect(result.direct_upload.headers).toBeDefined();
    expect(typeof result.direct_upload.headers).toBe("object");
  });

  it("uploadFile succeeds with the presigned URL", async () => {
    const checksum = md5Base64(TEST_PNG);
    const upload = await createDirectUpload(
      CIRCLE_TOKEN,
      "test-upload-verify.png",
      TEST_PNG.length,
      "image/png",
      checksum
    );

    // Should not throw
    await uploadFile(
      upload.direct_upload.url,
      upload.direct_upload.headers,
      TEST_PNG
    );
  });

  it("uploadFile rejects on bad presigned URL", async () => {
    await expect(
      uploadFile(
        "https://httpbin.org/status/403",
        { "Content-Type": "image/png" },
        TEST_PNG
      )
    ).rejects.toThrow(/upload failed/i);
  });
});

// ── Full import with images ─────────────────────────────────────────────────

describe("Import flow with image upload", () => {
  let client: CircleTestClient;
  let events: Array<Record<string, unknown>>;
  let log: ImportLog;

  const course = {
    name: `${TEST_PREFIX}img_${TIMESTAMP}`,
    slug: `test-bv-migrate-img-${TIMESTAMP}`,
    sections: [
      {
        name: "Section with Images",
        lessons: [
          {
            name: "Lesson with Image Placeholder",
            blocks: [
              { type: "heading" as const, level: 2 as const, text: "Image Test" },
              {
                type: "image_placeholder" as const,
                index: 1,
                description: "Test diagram for integration",
              },
              {
                type: "text" as const,
                html: "<p>Text after image placeholder.</p>",
              },
            ],
          },
          {
            name: "Lesson with Multiple Placeholders",
            blocks: [
              {
                type: "image_placeholder" as const,
                index: 2,
                description: "Second test image",
              },
              {
                type: "image_placeholder" as const,
                index: 3,
                description: "Third test image (no upload)",
              },
            ],
          },
        ],
      },
    ],
  };

  // imageData for placeholders 1 and 2 (but NOT 3 — tests partial upload)
  const imageData = {
    1: { filename: "test-diagram.png", dataUrl: testPngDataUrl() },
    2: { filename: "second-image.png", dataUrl: testPngDataUrl() },
  };

  beforeAll(async () => {
    client = new CircleTestClient(CIRCLE_TOKEN, SPACE_GROUP_ID);

    const body = {
      course,
      circleToken: CIRCLE_TOKEN,
      spaceGroupId: SPACE_GROUP_ID,
      geniallyUrls: {},
      imageData,
    };

    const req = new NextRequest("http://localhost/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    events = await collectSSEEvents(response);

    const completeEvent = findEvent(events, "complete");
    if (completeEvent?.log) {
      log = completeEvent.log as ImportLog;
      client.trackSpace(log.courseId);
    }
  });

  afterAll(async () => {
    await client.cleanup();
  });

  // ── Basic import success ──────────────────────────────────────────────────

  it("import completed without errors", () => {
    const errorEvent = findEvent(events, "error");
    if (errorEvent) {
      throw new Error(`Import error: ${JSON.stringify(errorEvent)}`);
    }
    expect(findEvent(events, "complete")).toBeDefined();
    expect(log).toBeDefined();
  });

  // ── Image upload log ──────────────────────────────────────────────────────

  it("uploadedImages in log contains entries for placeholders 1 and 2", () => {
    expect(log).toBeDefined();
    expect(log.uploadedImages).toBeDefined();
    expect(log.uploadedImages!.length).toBe(2);

    const indices = log.uploadedImages!.map((img) => img.placeholderIndex).sort();
    expect(indices).toEqual([1, 2]);
  });

  it("each uploaded image has a valid signed_id (eyJ... format)", () => {
    expect(log.uploadedImages).toBeDefined();
    for (const img of log.uploadedImages!) {
      expect(img.signedId).toMatch(/^eyJ/);
      expect(img.signedId.length).toBeGreaterThan(10);
    }
  });

  it("uploaded images have correct descriptions from the course structure", () => {
    expect(log.uploadedImages).toBeDefined();
    const img1 = log.uploadedImages!.find((i) => i.placeholderIndex === 1);
    const img2 = log.uploadedImages!.find((i) => i.placeholderIndex === 2);
    expect(img1?.description).toBe("Test diagram for integration");
    expect(img2?.description).toBe("Second test image");
  });

  it("placeholder 3 (no imageData provided) is NOT in uploadedImages", () => {
    expect(log.uploadedImages).toBeDefined();
    const img3 = log.uploadedImages!.find((i) => i.placeholderIndex === 3);
    expect(img3).toBeUndefined();
  });

  // ── Lesson body_html verification ─────────────────────────────────────────

  it("lesson 1 body_html contains signed_id reference for placeholder 1", async () => {
    expect(log).toBeDefined();
    const lessonId = log.sections[0].lessons[0].id;
    const detail = await client.getLessonDetail(lessonId);

    const img1 = log.uploadedImages!.find((i) => i.placeholderIndex === 1);
    expect(img1).toBeDefined();

    // Import route injects: "📸 Image uploaded to Circle CDN. signed_id: <id>"
    expect(detail.body_html).toContain(img1!.signedId);
    expect(detail.body_html).toContain("Image uploaded to Circle CDN");
  });

  it("lesson 1 still contains the placeholder marker for fallback", async () => {
    const lessonId = log.sections[0].lessons[0].id;
    const detail = await client.getLessonDetail(lessonId);

    // The original placeholder HTML should still be present
    expect(detail.body_html).toContain("[IMAGE 1:");
  });

  it("lesson 2 has signed_id for placeholder 2 but NOT for placeholder 3", async () => {
    const lessonId = log.sections[0].lessons[1].id;
    const detail = await client.getLessonDetail(lessonId);

    const img2 = log.uploadedImages!.find((i) => i.placeholderIndex === 2);
    expect(img2).toBeDefined();
    expect(detail.body_html).toContain(img2!.signedId);

    // Placeholder 3 had no image data — should just have the placeholder marker
    expect(detail.body_html).toContain("[IMAGE 3:");
    // And no signed_id injection for placeholder 3
    const lines = detail.body_html.split("\n");
    const img3CdnLines = lines.filter(
      (l) => l.includes("signed_id:") && l.includes("IMAGE 3")
    );
    // The signed_id note is injected AFTER the placeholder, not inside it.
    // For placeholder 3, there should be no CDN note at all.
    const allSignedIds = log.uploadedImages!.map((i) => i.signedId);
    // Count occurrences of signed_ids in the body — should only match img2's
    let foreignMatches = 0;
    for (const sid of allSignedIds) {
      if (sid === img2!.signedId) continue;
      if (detail.body_html.includes(sid)) foreignMatches++;
    }
    expect(foreignMatches).toBe(0);
  });
});
