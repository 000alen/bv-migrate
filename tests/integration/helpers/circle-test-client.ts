/**
 * Thin wrapper around lib/circle.ts for integration tests.
 *
 * Tracks every created resource (spaces only — space deletion cascades to
 * sections and lessons). Provides cleanup() and sweep() for safe teardown.
 */

import {
  createCourse,
  createSection,
  createLesson,
  getCourseSections,
  getCourseLessons,
  getLessonDetail,
  BASE_URL,
  authHeaders,
  CircleCourse,
  CircleSection,
  CircleLesson,
  CircleLessonDetail,
} from "@/lib/circle";
import { TEST_PREFIX } from "../config";

export class CircleTestClient {
  private trackedSpaceIds: number[] = [];

  constructor(
    private readonly token: string,
    private readonly spaceGroupId: number
  ) {}

  /**
   * Register an externally-created space ID for cleanup.
   * Useful when the space was created by calling an API route handler directly.
   */
  trackSpace(id: number): void {
    if (!this.trackedSpaceIds.includes(id)) {
      this.trackedSpaceIds.push(id);
    }
  }

  // ── Write methods (track created resources) ──────────────────────────────

  async createCourse(name: string, slug: string): Promise<CircleCourse> {
    const course = await createCourse(this.token, name, slug, this.spaceGroupId);
    this.trackSpace(course.id);
    return course;
  }

  async createSection(spaceId: number, name: string): Promise<CircleSection> {
    return createSection(this.token, spaceId, name);
  }

  async createLesson(
    sectionId: number,
    name: string,
    bodyHtml: string
  ): Promise<CircleLesson> {
    return createLesson(this.token, sectionId, name, bodyHtml);
  }

  // ── Read methods (with retry for eventual consistency) ─────────────────

  async getCourseSections(spaceId: number): Promise<CircleSection[]> {
    return this.retryRead(() => getCourseSections(this.token, spaceId));
  }

  async getCourseLessons(sectionId: number): Promise<CircleLesson[]> {
    return this.retryRead(() => getCourseLessons(this.token, sectionId));
  }

  async getLessonDetail(lessonId: number): Promise<CircleLessonDetail> {
    return this.retryRead(() => getLessonDetail(this.token, lessonId));
  }

  /**
   * Retry a read operation up to `maxAttempts` times with a delay between attempts.
   * Handles Circle's eventual consistency: records may not be immediately
   * readable after creation.
   */
  private async retryRead<T>(
    fn: () => Promise<T>,
    maxAttempts = 4,
    delayMs = 1500
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await fn();
        // For arrays, retry if empty (eventual consistency may return [] briefly)
        if (Array.isArray(result) && result.length === 0 && attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        return result;
      } catch (err) {
        if (attempt === maxAttempts) throw err;
        const msg = err instanceof Error ? err.message : "";
        // "Missing record" is Circle's eventual consistency error
        if (msg.includes("Missing record") || msg.includes("404")) {
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        throw err;
      }
    }
    throw new Error("retryRead: exhausted all attempts");
  }

  // ── Deletion ─────────────────────────────────────────────────────────────

  /**
   * DELETE /spaces/:id — cascades to sections and lessons.
   * Removes the ID from the tracked registry so cleanup() won't retry it.
   */
  async deleteSpace(spaceId: number): Promise<void> {
    const res = await fetch(`${BASE_URL}/spaces/${spaceId}`, {
      method: "DELETE",
      headers: authHeaders(this.token, "DELETE"),
    });
    // 404 means already deleted — that's fine
    if (!res.ok && res.status !== 404) {
      console.warn(
        `CircleTestClient.deleteSpace(${spaceId}): ${res.status} ${res.statusText}`
      );
    }
    this.trackedSpaceIds = this.trackedSpaceIds.filter((id) => id !== spaceId);
  }

  /**
   * Delete all tracked spaces in reverse creation order.
   * Should be called in afterAll hooks.
   */
  async cleanup(): Promise<void> {
    const ids = [...this.trackedSpaceIds].reverse();
    for (const id of ids) {
      try {
        await this.deleteSpace(id);
      } catch (err) {
        console.warn(`CircleTestClient.cleanup: failed to delete space ${id}:`, err);
      }
    }
    this.trackedSpaceIds = [];
  }

  // ── Sweep ─────────────────────────────────────────────────────────────────

  /**
   * List all spaces in the space group, find any whose name starts with
   * TEST_PREFIX, and delete them. Useful for cleaning up after interrupted runs.
   */
  async sweep(): Promise<void> {
    const spaces = await this.listSpaces();
    const testSpaces = spaces.filter((s) => s.name.startsWith(TEST_PREFIX));
    for (const space of testSpaces) {
      try {
        await this.deleteSpace(space.id);
      } catch (err) {
        console.warn(
          `CircleTestClient.sweep: failed to delete space ${space.id} "${space.name}":`,
          err
        );
      }
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async listSpaces(): Promise<CircleCourse[]> {
    const all: CircleCourse[] = [];
    let page = 1;
    for (;;) {
      const res = await fetch(
        `${BASE_URL}/spaces?space_group_id=${this.spaceGroupId}&page=${page}&per_page=100`,
        {
          method: "GET",
          headers: authHeaders(this.token, "GET"),
        }
      );
      if (!res.ok) break;
      const data = (await res.json()) as Record<string, unknown>;
      const records = (
        Array.isArray(data.records) ? data.records : []
      ) as CircleCourse[];
      all.push(...records);
      if (!data.has_next_page) break;
      page++;
    }
    return all;
  }
}
