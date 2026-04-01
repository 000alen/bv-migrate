/**
 * Integration tests: partial failure handling.
 *
 * Two scenarios:
 *
 * A) Import with a non-existent spaceGroupId — course creation fails immediately,
 *    so the error event should have partial: null (nothing was created).
 *
 * B) Course creation succeeds but section creation fails (invalid space_id) —
 *    verifies that the orphaned course can be identified and deleted.
 *    This exercises the cleanup responsibility that callers have when the
 *    import route returns partial: { courseId: N, ... }.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/import/route";
import { CircleTestClient } from "./helpers/circle-test-client";
import { makeTestCourse } from "./helpers/test-course";
import { collectSSEEvents, findEvent } from "./helpers/sse-utils";
import {
  hasCircleIntegrationEnv,
  getCircleIntegrationEnv,
  TEST_PREFIX,
} from "./config";

const TIMESTAMP = Date.now();

describe.skipIf(!hasCircleIntegrationEnv())("Partial failure (integration)", () => {
  let CIRCLE_TOKEN: string;
  let SPACE_GROUP_ID: number;

  beforeAll(() => {
    const e = getCircleIntegrationEnv();
    CIRCLE_TOKEN = e.CIRCLE_TOKEN;
    SPACE_GROUP_ID = e.SPACE_GROUP_ID;
  });

  // ── Scenario A: full failure (course not created) ──────────────────────────

  describe("Partial failure — course creation fails (bad spaceGroupId)", () => {
    it("returns error event with partial: null", async () => {
      const course = makeTestCourse(`${TIMESTAMP}_fail`);

      const body = {
        course,
        circleToken: CIRCLE_TOKEN,
        spaceGroupId: 999_999_999, // non-existent space group
        geniallyUrls: {},
      };

      const req = new NextRequest("http://localhost/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const response = await POST(req);
      const events = await collectSSEEvents(response);

      const errorEvent = findEvent(events, "error");
      expect(errorEvent, "expected an error event").toBeDefined();
      expect(errorEvent!.partial).toBeNull();
      expect(typeof errorEvent!.message).toBe("string");
      expect((errorEvent!.message as string).length).toBeGreaterThan(0);
    });
  });

  // ── Scenario B: partial failure (course created, section fails) ────────────

  describe("Partial failure — section creation fails after course is created", () => {
    let client: CircleTestClient;
    let orphanedCourseId: number | null = null;

    beforeAll(() => {
      client = new CircleTestClient(CIRCLE_TOKEN, SPACE_GROUP_ID);
    });

    afterAll(async () => {
      // Safety net: delete the orphaned course if the test didn't already
      if (orphanedCourseId !== null) {
        try {
          await client.deleteSpace(orphanedCourseId);
        } catch {
          // best effort
        }
      }
      await client.cleanup();
    });

    it("createCourse succeeds with valid credentials", async () => {
      const course = await client.createCourse(
        `${TEST_PREFIX}partial_${TIMESTAMP}`,
        `test-bv-migrate-partial-${TIMESTAMP}`
      );
      expect(course.id).toBeGreaterThan(0);
      orphanedCourseId = course.id;
      // Intentionally NOT tracked via client.trackSpace so we test manual cleanup below
    });

    it("createSection throws a Circle API error for a non-existent space_id", async () => {
      expect(orphanedCourseId, "orphanedCourseId must be set by previous test").not.toBeNull();

      await expect(
        client.createSection(999_999_999, "Should fail — bad space_id")
      ).rejects.toThrow(/Circle API/i);
    });

    it("orphaned course still exists in Circle (partial state)", async () => {
      expect(orphanedCourseId).not.toBeNull();
      // getCourseSections on a valid but empty course should return []
      const sections = await client.getCourseSections(orphanedCourseId!);
      expect(sections).toEqual([]);
    });

    it("orphaned course can be deleted (caller cleanup)", async () => {
      expect(orphanedCourseId).not.toBeNull();
      await client.deleteSpace(orphanedCourseId!);
      orphanedCourseId = null;
    });
  });
});
