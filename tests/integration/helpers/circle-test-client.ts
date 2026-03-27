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

  // ── Read methods ─────────────────────────────────────────────────────────

  getCourseSections(spaceId: number): Promise<CircleSection[]> {
    return getCourseSections(this.token, spaceId);
  }

  getCourseLessons(sectionId: number): Promise<CircleLesson[]> {
    return getCourseLessons(this.token, sectionId);
  }

  getLessonDetail(lessonId: number): Promise<CircleLessonDetail> {
    return getLessonDetail(this.token, lessonId);
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
