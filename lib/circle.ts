export const BASE_URL = "https://app.circle.so/api/admin/v2";

export function authHeaders(token: string, method: "GET" | "POST" | "PUT" | "DELETE" = "POST"): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": "bv-migrate/1.0 (beVisioneers Content Constructors)",
    Accept: "application/json",
    Authorization: `Token ${token}`,
  };
  // Only include Content-Type for methods that send a body
  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

// ── Retry with exponential backoff ──────────────────────────────────────────

interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: RetryOptions = {}
): Promise<Response> {
  const { maxAttempts = 3, baseDelayMs = 1000 } = opts;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, init);

    if (res.ok) return res;

    // Rate limited — respect Retry-After or use exponential backoff
    if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After");
      const delayMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : baseDelayMs * Math.pow(2, attempt - 1);

      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
    }

    // Server error — retry with backoff
    if (res.status >= 500 && attempt < maxAttempts) {
      await new Promise((r) =>
        setTimeout(r, baseDelayMs * Math.pow(2, attempt - 1))
      );
      continue;
    }

    // Parse error body
    let message = `Circle API error ${res.status}: ${res.statusText}`;
    try {
      const body = await res.json();
      if (body.message) message = `Circle API: ${body.message}`;
      else if (body.error) message = `Circle API: ${body.error}`;
    } catch (e) {
      // Response body wasn't JSON — use the HTTP status message instead
      console.warn("Could not parse Circle error response body:", e);
    }

    // Client error or final attempt — throw
    throw new Error(message);
  }

  throw new Error("fetchWithRetry: exhausted all attempts");
}

// ── Circle API types ────────────────────────────────────────────────────────

export interface CircleCourse {
  id: number;
  name: string;
  slug: string;
}

export interface CircleSection {
  id: number;
  name: string;
}

export interface CircleLesson {
  id: number;
  name: string;
}

// ── API methods ─────────────────────────────────────────────────────────────

export async function createCourse(
  token: string,
  name: string,
  slug: string,
  spaceGroupId: number
): Promise<CircleCourse> {
  const res = await fetchWithRetry(
    `${BASE_URL}/spaces`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        name,
        slug,
        space_type: "course",
        is_private: false,
        is_post_disabled: true,
        space_group_id: spaceGroupId,
        course_setting: {
          course_type: "self_paced",
          enforce_lessons_order: false,
          custom_lesson_label: "lesson",
          custom_section_label: "unit",
        },
      }),
    }
  );
  const data = (await res.json()) as { space: CircleCourse } | CircleCourse;
  // Circle wraps the response in { space: ... }
  return "space" in data ? data.space : data;
}

export async function createSection(
  token: string,
  spaceId: number,
  name: string
): Promise<CircleSection> {
  const res = await fetchWithRetry(
    `${BASE_URL}/course_sections`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ name, space_id: spaceId }),
    }
  );
  return (await res.json()) as CircleSection;
}

export async function createLesson(
  token: string,
  sectionId: number,
  name: string,
  bodyHtml: string
): Promise<CircleLesson> {
  const res = await fetchWithRetry(
    `${BASE_URL}/course_lessons`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        name,
        section_id: sectionId,
        body_html: bodyHtml,
        status: "draft",
        is_comments_enabled: true,
      }),
    }
  );
  return (await res.json()) as CircleLesson;
}

export interface CircleLessonDetail {
  id: number;
  name: string;
  body_html: string;
}

export interface DirectUploadResponse {
  signed_id: string;
  direct_upload: {
    url: string;
    headers: Record<string, string>;
  };
}

export async function getCourseSections(token: string, spaceId: number): Promise<CircleSection[]> {
  // Circle returns paginated: { page, per_page, has_next_page, count, records: [...] }
  const all: CircleSection[] = [];
  let page = 1;
  for (;;) {
    const res = await fetchWithRetry(
      `${BASE_URL}/course_sections?space_id=${spaceId}&page=${page}&per_page=100`,
      { method: "GET", headers: authHeaders(token, "GET") }
    );
    const data = await res.json() as Record<string, unknown>;
    const records = (Array.isArray(data.records) ? data.records : []) as CircleSection[];
    all.push(...records);
    if (!data.has_next_page) break;
    page++;
  }
  return all;
}

export async function getCourseLessons(token: string, sectionId: number): Promise<CircleLesson[]> {
  // Circle returns paginated: { page, per_page, has_next_page, count, records: [...] }
  const all: CircleLesson[] = [];
  let page = 1;
  for (;;) {
    const res = await fetchWithRetry(
      `${BASE_URL}/course_lessons?section_id=${sectionId}&page=${page}&per_page=100`,
      { method: "GET", headers: authHeaders(token, "GET") }
    );
    const data = await res.json() as Record<string, unknown>;
    const records = (Array.isArray(data.records) ? data.records : []) as CircleLesson[];
    all.push(...records);
    if (!data.has_next_page) break;
    page++;
  }
  return all;
}

export async function getLessonDetail(token: string, lessonId: number): Promise<CircleLessonDetail> {
  const res = await fetchWithRetry(
    `${BASE_URL}/course_lessons/${lessonId}`,
    { method: "GET", headers: authHeaders(token, "GET") }
  );
  const data = await res.json() as unknown;
  const obj = data as Record<string, unknown>;
  if (obj.course_lesson) return obj.course_lesson as CircleLessonDetail;
  return data as CircleLessonDetail;
}

export async function createDirectUpload(
  token: string,
  filename: string,
  byteSize: number,
  contentType: string,
  checksum: string
): Promise<DirectUploadResponse> {
  // Circle requires a random key for the blob
  const key = crypto.randomUUID().replace(/-/g, "");
  const res = await fetchWithRetry(
    `${BASE_URL}/direct_uploads`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        blob: {
          key,
          filename,
          content_type: contentType,
          byte_size: byteSize,
          checksum,
        },
      }),
    }
  );
  return (await res.json()) as DirectUploadResponse;
}

export async function uploadFile(
  presignedUrl: string,
  headers: Record<string, string>,
  fileData: Buffer
): Promise<void> {
  // Convert Buffer to ArrayBuffer for fetch compatibility
  const arrayBuffer = fileData.buffer.slice(
    fileData.byteOffset,
    fileData.byteOffset + fileData.byteLength
  ) as ArrayBuffer;
  const res = await fetch(presignedUrl, {
    method: "PUT",
    headers,
    body: arrayBuffer,
  });
  if (!res.ok) {
    throw new Error(`File upload failed: ${res.status} ${res.statusText}`);
  }
}
