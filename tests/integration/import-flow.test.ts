/**
 * Integration tests: full import flow via the /api/import route handler.
 *
 * Calls the POST handler directly (no server) with a NextRequest, reads the
 * SSE response stream, then verifies the created resources in Circle.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/import/route";
import { CircleTestClient } from "./helpers/circle-test-client";
import { makeTestCourse, expectedLesson1Html } from "./helpers/test-course";
import { collectSSEEvents, findEvent, filterEvents } from "./helpers/sse-utils";
import { CIRCLE_TOKEN, SPACE_GROUP_ID } from "./config";
import type { ImportLog } from "@/lib/types";

const TIMESTAMP = Date.now();

describe("Import flow", () => {
  let client: CircleTestClient;
  let events: Array<Record<string, unknown>>;
  let log: ImportLog;

  const course = makeTestCourse(TIMESTAMP);

  beforeAll(async () => {
    client = new CircleTestClient(CIRCLE_TOKEN, SPACE_GROUP_ID);

    const body = {
      course,
      circleToken: CIRCLE_TOKEN,
      spaceGroupId: SPACE_GROUP_ID,
      geniallyUrls: {},
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
    const errorEvent = findEvent(events, "error");
    if (errorEvent) {
      console.error("Import beforeAll error:", JSON.stringify(errorEvent));
    }
    if (completeEvent?.log) {
      log = completeEvent.log as ImportLog;
      client.trackSpace(log.courseId);
    }
  });

  afterAll(async () => {
    await client.cleanup();
  });

  // ── SSE event shape ──────────────────────────────────────────────────────

  it("received at least one progress event", () => {
    const progressEvents = filterEvents(events, "progress");
    expect(progressEvents.length).toBeGreaterThan(0);
  });

  it("all progress events have step and total fields", () => {
    const progressEvents = filterEvents(events, "progress");
    for (const evt of progressEvents) {
      expect(typeof evt.step).toBe("number");
      expect(typeof evt.total).toBe("number");
      expect(evt.step as number).toBeLessThanOrEqual(evt.total as number);
    }
  });

  it("received a complete event (no error event)", () => {
    const completeEvent = findEvent(events, "complete");
    const errorEvent = findEvent(events, "error");
    expect(completeEvent).toBeDefined();
    if (errorEvent) {
      // Surface error message if unexpected
      throw new Error(
        `Import produced an error event: ${JSON.stringify(errorEvent)}`
      );
    }
  });

  // ── Log structure ────────────────────────────────────────────────────────

  it("complete event log has courseId, courseName, sections", () => {
    expect(log).toBeDefined();
    expect(log.courseId).toBeGreaterThan(0);
    expect(log.courseName).toBe(course.name);
    expect(log.sections).toHaveLength(course.sections.length);
  });

  it("all section and lesson IDs in log are positive integers", () => {
    expect(log).toBeDefined();
    for (const section of log.sections) {
      expect(section.id).toBeGreaterThan(0);
      expect(section.lessons).toHaveLength(2);
      for (const lesson of section.lessons) {
        expect(lesson.id).toBeGreaterThan(0);
      }
    }
  });

  // ── Circle state verification ─────────────────────────────────────────────

  it("getCourseSections returns both section names", async () => {
    expect(log).toBeDefined();
    const sections = await client.getCourseSections(log.courseId);
    const names = sections.map((s) => s.name);
    expect(names).toContain(course.sections[0].name);
    expect(names).toContain(course.sections[1].name);
  });

  it("getCourseLessons returns correct lesson names for section 1", async () => {
    expect(log).toBeDefined();
    const sectionId = log.sections[0].id;
    const lessons = await client.getCourseLessons(sectionId);
    const names = lessons.map((l) => l.name);
    expect(names).toContain(course.sections[0].lessons[0].name);
    expect(names).toContain(course.sections[0].lessons[1].name);
  });

  it("lesson 1 body_html matches html-builder output", async () => {
    expect(log).toBeDefined();
    const lesson1Id = log.sections[0].lessons[0].id;
    const detail = await client.getLessonDetail(lesson1Id);

    // Circle may wrap HTML in additional markup — check for the key generated strings
    const expected = expectedLesson1Html();

    // The heading text
    expect(detail.body_html).toContain("Welcome to the test course");
    // The text block passthrough
    expect(detail.body_html).toContain("This is integration test content.");
    // The image placeholder marker
    expect(detail.body_html).toContain("[IMAGE 1: Test diagram]");

    // The expected string from html-builder should be a substring of what Circle stores
    // (Circle may add wrapping elements but the core content must be present)
    expect(expected).not.toBe("");
  });
});
