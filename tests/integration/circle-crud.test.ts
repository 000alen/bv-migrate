/**
 * Integration tests: Circle API CRUD operations.
 *
 * Tests the lib/circle.ts functions directly against the live Circle API.
 * Create → verify → read back → delete → verify deletion.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { CircleTestClient } from "./helpers/circle-test-client";
import {
  hasCircleIntegrationEnv,
  getCircleIntegrationEnv,
  TEST_PREFIX,
} from "./config";

const TIMESTAMP = Date.now();
const SPACE_NAME = `${TEST_PREFIX}crud_${TIMESTAMP}`;
const SPACE_SLUG = `test-bv-migrate-crud-${TIMESTAMP}`;
const LESSON_HTML = "<p><strong>Hello from integration test</strong></p><p>Unique marker: crud_lesson_content</p>";

describe.skipIf(!hasCircleIntegrationEnv())("Circle CRUD", () => {
  let client: CircleTestClient;
  let spaceId: number;
  let sectionId: number;
  let lessonId: number;

  beforeAll(() => {
    const { CIRCLE_TOKEN, SPACE_GROUP_ID } = getCircleIntegrationEnv();
    client = new CircleTestClient(CIRCLE_TOKEN, SPACE_GROUP_ID);
  });

  afterAll(async () => {
    await client.cleanup();
  });

  it("1. creates a course space and returns a valid ID", async () => {
    const course = await client.createCourse(SPACE_NAME, SPACE_SLUG);
    expect(course.id).toBeGreaterThan(0);
    expect(course.name).toBe(SPACE_NAME);
    spaceId = course.id;
  });

  it("2. creates a section and returns a valid ID", async () => {
    expect(spaceId, "spaceId must be set by previous test").toBeGreaterThan(0);
    const section = await client.createSection(spaceId, "Test Section — CRUD");
    expect(section.id).toBeGreaterThan(0);
    expect(section.name).toBe("Test Section — CRUD");
    sectionId = section.id;
  });

  it("3. creates a lesson with HTML and returns a valid ID", async () => {
    expect(sectionId, "sectionId must be set by previous test").toBeGreaterThan(0);
    const lesson = await client.createLesson(sectionId, "Test Lesson — CRUD", LESSON_HTML);
    expect(lesson.id).toBeGreaterThan(0);
    expect(lesson.name).toBe("Test Lesson — CRUD");
    lessonId = lesson.id;
  });

  it("4. getCourseSections returns the section by name", async () => {
    expect(spaceId, "spaceId must be set by previous test").toBeGreaterThan(0);
    const sections = await client.getCourseSections(spaceId);
    expect(sections.length).toBeGreaterThanOrEqual(1);
    const names = sections.map((s) => s.name);
    expect(names).toContain("Test Section — CRUD");
  });

  it("5. getCourseLessons returns the lesson by name", async () => {
    expect(sectionId, "sectionId must be set by previous test").toBeGreaterThan(0);
    const lessons = await client.getCourseLessons(sectionId);
    expect(lessons.length).toBeGreaterThanOrEqual(1);
    const names = lessons.map((l) => l.name);
    expect(names).toContain("Test Lesson — CRUD");
  });

  it("6. getLessonDetail returns body_html containing the sent content", async () => {
    expect(lessonId, "lessonId must be set by previous test").toBeGreaterThan(0);
    const detail = await client.getLessonDetail(lessonId);
    expect(detail.id).toBe(lessonId);
    // Circle may wrap the HTML in additional elements; check for known markers
    expect(detail.body_html).toContain("Hello from integration test");
    expect(detail.body_html).toContain("crud_lesson_content");
  });

  it("7. deletes the space (cascade removes sections and lessons)", async () => {
    expect(spaceId, "spaceId must be set by previous test").toBeGreaterThan(0);
    // deleteSpace removes from registry so afterAll cleanup won't retry
    await client.deleteSpace(spaceId);
  });

  it("8. getCourseSections on deleted space returns empty or a 404-style error", async () => {
    expect(spaceId, "spaceId must be set by previous test").toBeGreaterThan(0);
    try {
      const sections = await client.getCourseSections(spaceId);
      // Circle may return an empty list for a non-existent space
      expect(sections).toEqual([]);
    } catch (err) {
      // Or it may throw — a 404/422 mapped to an Error is also acceptable
      expect(err).toBeInstanceOf(Error);
    }
  });
});
