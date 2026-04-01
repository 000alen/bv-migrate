/**
 * Integration tests: consolidate flow via the /api/consolidate route handler.
 *
 * Creates 2 source courses directly (faster than going through /api/import),
 * then consolidates them into a combined course and verifies the result.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/consolidate/route";
import { CircleTestClient } from "./helpers/circle-test-client";
import { collectSSEEvents, findEvent, filterEvents } from "./helpers/sse-utils";
import {
  hasCircleIntegrationEnv,
  getCircleIntegrationEnv,
  TEST_PREFIX,
} from "./config";
import type { ConsolidateLog } from "@/lib/types";

const TIMESTAMP = Date.now();

describe.skipIf(!hasCircleIntegrationEnv())("Consolidate flow", () => {
  let client: CircleTestClient;
  let source1Id: number;
  let source2Id: number;
  let events: Array<Record<string, unknown>>;
  let log: ConsolidateLog;

  const SOURCE_1_LABEL = "Source Module 1";
  const SOURCE_2_LABEL = "Source Module 2";

  beforeAll(async () => {
    const { CIRCLE_TOKEN, SPACE_GROUP_ID } = getCircleIntegrationEnv();
    client = new CircleTestClient(CIRCLE_TOKEN, SPACE_GROUP_ID);

    // Create source course 1 with 1 section + 1 lesson
    const course1 = await client.createCourse(
      `${TEST_PREFIX}consol_src1_${TIMESTAMP}`,
      `test-bv-migrate-consol-src1-${TIMESTAMP}`
    );
    source1Id = course1.id;
    const sec1 = await client.createSection(source1Id, "Basics");
    await client.createLesson(
      sec1.id,
      "Intro Lesson",
      "<p>Source 1 intro content — unique marker: src1_intro</p>"
    );

    // Create source course 2 with 1 section + 1 lesson
    const course2 = await client.createCourse(
      `${TEST_PREFIX}consol_src2_${TIMESTAMP}`,
      `test-bv-migrate-consol-src2-${TIMESTAMP}`
    );
    source2Id = course2.id;
    const sec2 = await client.createSection(source2Id, "Advanced");
    await client.createLesson(
      sec2.id,
      "Advanced Lesson",
      "<p>Source 2 advanced content — unique marker: src2_advanced</p>"
    );

    // Wait for Circle's eventual consistency before reading back
    await new Promise((r) => setTimeout(r, 3000));

    // Run the consolidate route handler
    const body = {
      sources: [
        { spaceId: source1Id, label: SOURCE_1_LABEL },
        { spaceId: source2Id, label: SOURCE_2_LABEL },
      ],
      combinedName: `${TEST_PREFIX}combined_${TIMESTAMP}`,
      combinedSlug: `test-bv-migrate-combined-${TIMESTAMP}`,
      circleToken: CIRCLE_TOKEN,
      spaceGroupId: SPACE_GROUP_ID,
    };

    const req = new NextRequest("http://localhost/api/consolidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    events = await collectSSEEvents(response);

    const completeEvent = findEvent(events, "complete");
    const errorEvent = findEvent(events, "error");
    if (errorEvent) {
      console.error("Consolidate beforeAll error:", JSON.stringify(errorEvent));
    }
    if (completeEvent?.log) {
      log = completeEvent.log as ConsolidateLog;
      client.trackSpace(log.courseId);
    }
  });

  afterAll(async () => {
    await client.cleanup();
  });

  // ── SSE events ────────────────────────────────────────────────────────────

  it("received progress events during consolidation", () => {
    const progressEvents = filterEvents(events, "progress");
    expect(progressEvents.length).toBeGreaterThan(0);
  });

  it("received a complete event (no error)", () => {
    const completeEvent = findEvent(events, "complete");
    const errorEvent = findEvent(events, "error");
    expect(completeEvent).toBeDefined();
    if (errorEvent) {
      throw new Error(
        `Consolidate produced an error event: ${JSON.stringify(errorEvent)}`
      );
    }
  });

  // ── Log structure ─────────────────────────────────────────────────────────

  it("complete event log has courseId and sections from both sources", () => {
    expect(log).toBeDefined();
    expect(log.courseId).toBeGreaterThan(0);
    // 1 section from each source = 2 total
    expect(log.sections).toHaveLength(2);
    for (const section of log.sections) {
      expect(section.id).toBeGreaterThan(0);
      expect(section.lessons.length).toBeGreaterThanOrEqual(1);
    }
  });

  // ── Circle state verification ─────────────────────────────────────────────

  it("combined course has sections from both source labels", async () => {
    expect(log).toBeDefined();
    const sections = await client.getCourseSections(log.courseId);
    expect(sections).toHaveLength(2);

    const names = sections.map((s) => s.name);
    // consolidate route names sections as "{label} — {original section name}"
    expect(names.some((n) => n.startsWith(SOURCE_1_LABEL))).toBe(true);
    expect(names.some((n) => n.startsWith(SOURCE_2_LABEL))).toBe(true);
  });

  it("lessons from source 1 have their body_html preserved", async () => {
    expect(log).toBeDefined();
    const sections = await client.getCourseSections(log.courseId);
    const src1Section = sections.find((s) => s.name.startsWith(SOURCE_1_LABEL));
    expect(src1Section).toBeDefined();

    const lessons = await client.getCourseLessons(src1Section!.id);
    expect(lessons.length).toBeGreaterThanOrEqual(1);

    const detail = await client.getLessonDetail(lessons[0].id);
    expect(detail.body_html).toContain("src1_intro");
  });

  it("lessons from source 2 have their body_html preserved", async () => {
    expect(log).toBeDefined();
    const sections = await client.getCourseSections(log.courseId);
    const src2Section = sections.find((s) => s.name.startsWith(SOURCE_2_LABEL));
    expect(src2Section).toBeDefined();

    const lessons = await client.getCourseLessons(src2Section!.id);
    expect(lessons.length).toBeGreaterThanOrEqual(1);

    const detail = await client.getLessonDetail(lessons[0].id);
    expect(detail.body_html).toContain("src2_advanced");
  });
});
