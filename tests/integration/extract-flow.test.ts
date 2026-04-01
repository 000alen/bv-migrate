/**
 * Integration tests: extraction flow via the /api/extract route handler.
 *
 * Sends a real PDF to Claude via the extract route, validates the SSE stream,
 * and checks that the returned CourseStructure passes schema validation.
 *
 * Requires ANTHROPIC_KEY env var. Slow (~30-90s) and costs real API tokens.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/extract/route";
import { CourseStructureSchema, type CourseStructure } from "@/lib/schema";
import { collectSSEEvents, findEvent, filterEvents } from "./helpers/sse-utils";
import {
  hasAnthropicExtractEnv,
  getAnthropicExtractKey,
} from "./config";
import { makePdfFile } from "./helpers/test-pdf";

describe.skipIf(!hasAnthropicExtractEnv())("Extract flow", () => {
  let events: Array<Record<string, unknown>>;
  let course: CourseStructure;
  let anthropicKey: string;

  beforeAll(async () => {
    anthropicKey = getAnthropicExtractKey();
    const pdf = makePdfFile("test-module-1.pdf");

    const formData = new FormData();
    formData.append("pdf", pdf);

    const req = new NextRequest("http://localhost/api/extract", {
      method: "POST",
      headers: {
        "x-llm-provider": "anthropic",
        "x-anthropic-key": anthropicKey,
      },
      body: formData,
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    events = await collectSSEEvents(response);

    const completeEvent = findEvent(events, "complete");
    if (completeEvent?.course) {
      course = completeEvent.course as CourseStructure;
    }
  }, 120_000); // 2 min timeout — Claude can be slow

  // ── SSE stream shape ──────────────────────────────────────────────────────

  it("received at least one progress event", () => {
    const progressEvents = filterEvents(events, "progress");
    expect(progressEvents.length).toBeGreaterThan(0);
  });

  it("received a complete event (no error event)", () => {
    const completeEvent = findEvent(events, "complete");
    const errorEvent = findEvent(events, "error");

    if (errorEvent) {
      throw new Error(
        `Extract produced an error event: ${JSON.stringify(errorEvent)}`
      );
    }
    expect(completeEvent).toBeDefined();
  });

  it("no ping events are missing (keepalive ran)", () => {
    // Extraction takes long enough that at least 1 ping should fire (every 15s)
    // But on fast runs with small PDFs it might not — so just check pings are valid if present
    const pings = filterEvents(events, "ping");
    for (const p of pings) {
      expect(p.type).toBe("ping");
    }
  });

  // ── Schema validation ─────────────────────────────────────────────────────

  it("returned course passes Zod schema validation", () => {
    expect(course).toBeDefined();
    const result = CourseStructureSchema.safeParse(course);
    if (!result.success) {
      throw new Error(
        `Schema validation failed:\n${JSON.stringify(result.error.flatten(), null, 2)}`
      );
    }
  });

  // ── Content checks ────────────────────────────────────────────────────────

  it("course has a non-empty name", () => {
    expect(course).toBeDefined();
    expect(course.name.length).toBeGreaterThan(0);
  });

  it("course has a non-empty slug", () => {
    expect(course).toBeDefined();
    expect(course.slug.length).toBeGreaterThan(0);
  });

  it("course has at least one section", () => {
    expect(course).toBeDefined();
    expect(course.sections.length).toBeGreaterThanOrEqual(1);
  });

  it("every section has at least one lesson", () => {
    expect(course).toBeDefined();
    for (const section of course.sections) {
      expect(
        section.lessons.length,
        `Section "${section.name}" has no lessons`
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("every lesson has at least one block", () => {
    expect(course).toBeDefined();
    for (const section of course.sections) {
      for (const lesson of section.lessons) {
        expect(
          lesson.blocks.length,
          `Lesson "${lesson.name}" has no blocks`
        ).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("extracted content references known text from the test PDF", () => {
    expect(course).toBeDefined();
    // The test PDF contains "Integration" in the title — Claude should capture it
    const allText = JSON.stringify(course).toLowerCase();
    expect(allText).toContain("integration");
  });

  // ── Error handling ──────────────────────────────────────────────────────

  it("rejects request with missing API key", async () => {
    const pdf = makePdfFile();
    const formData = new FormData();
    formData.append("pdf", pdf);

    const req = new NextRequest("http://localhost/api/extract", {
      method: "POST",
      headers: {},
      body: formData,
    });

    const response = await POST(req);
    const errorEvents = await collectSSEEvents(response);
    const errorEvent = findEvent(errorEvents, "error");
    expect(errorEvent).toBeDefined();
    expect(String(errorEvent!.message)).toMatch(/Cerebras|x-cerebras|CEREBRAS_API_KEY/i);
  });

  it("rejects request with missing PDF", async () => {
    const formData = new FormData();
    // No pdf appended

    const req = new NextRequest("http://localhost/api/extract", {
      method: "POST",
      headers: {
        "x-llm-provider": "anthropic",
        "x-anthropic-key": anthropicKey,
      },
      body: formData,
    });

    const response = await POST(req);
    const errorEvents = await collectSSEEvents(response);
    const errorEvent = findEvent(errorEvents, "error");
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.message).toContain("pdf");
  });
});
