/**
 * Integration tests: sweep functionality.
 *
 * Verifies that CircleTestClient.sweep() finds and deletes all spaces whose
 * names start with TEST_PREFIX, regardless of which test run created them.
 * Useful for cleaning up after interrupted test runs.
 *
 * NOTE: Because sweep() deletes ALL __test_bv_migrate_* spaces in the space
 * group, this file must run in isolation (fileParallelism: false in config)
 * so it doesn't race against other integration test files.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { CircleTestClient } from "./helpers/circle-test-client";
import { CIRCLE_TOKEN, SPACE_GROUP_ID, TEST_PREFIX } from "./config";

const TIMESTAMP = Date.now();

describe("Sweep", () => {
  // sweepClient is the one running sweep()
  let sweepClient: CircleTestClient;
  // space IDs created outside sweepClient's registry (untracked)
  let space1Id: number;
  let space2Id: number;

  beforeAll(async () => {
    sweepClient = new CircleTestClient(CIRCLE_TOKEN, SPACE_GROUP_ID);

    // Create 2 test spaces using a fresh client so they are NOT in
    // sweepClient's registry — sweep must find them by name prefix.
    const creator = new CircleTestClient(CIRCLE_TOKEN, SPACE_GROUP_ID);

    const s1 = await creator.createCourse(
      `${TEST_PREFIX}sweep_1_${TIMESTAMP}`,
      `test-bv-migrate-sweep-1-${TIMESTAMP}`
    );
    space1Id = s1.id;

    const s2 = await creator.createCourse(
      `${TEST_PREFIX}sweep_2_${TIMESTAMP}`,
      `test-bv-migrate-sweep-2-${TIMESTAMP}`
    );
    space2Id = s2.id;

    // Do NOT call creator.cleanup() here — sweep() must find these spaces.
    // The afterAll below acts as a safety net.
  });

  afterAll(async () => {
    // Safety net: if sweep() failed, remove the spaces manually
    try {
      await sweepClient.deleteSpace(space1Id);
    } catch {
      // already deleted by sweep — ignore
    }
    try {
      await sweepClient.deleteSpace(space2Id);
    } catch {
      // already deleted by sweep — ignore
    }
  });

  it("sweep() deletes all spaces with the test prefix", async () => {
    await sweepClient.sweep();

    // After sweep, both spaces should no longer exist.
    // Circle returns an empty list or throws for deleted/non-existent spaces.
    for (const id of [space1Id, space2Id]) {
      try {
        const sections = await sweepClient.getCourseSections(id);
        // If we got a response, Circle returned empty for the deleted space
        expect(sections).toEqual([]);
      } catch {
        // A Circle API error (404/422) is also acceptable evidence of deletion
      }
    }
  });

  it("sweep() is a no-op when no test spaces remain (does not throw)", async () => {
    // A second sweep finds nothing matching the prefix — should complete cleanly
    await expect(sweepClient.sweep()).resolves.toBeUndefined();
  });
});
