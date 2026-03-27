const BASE_URL = "https://app.circle.so/api/admin/v2";

function authHeaders(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "User-Agent": "bv-migrate/1.0 (beVisioneers Content Constructors)",
    Accept: "application/json",
    Authorization: `Token ${token}`,
  };
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

    // Client error or final attempt — parse and throw
    let message = `Circle API error ${res.status}: ${res.statusText}`;
    try {
      const body = await res.json();
      if (body.message) message = `Circle API: ${body.message}`;
      else if (body.error) message = `Circle API: ${body.error}`;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  throw new Error("fetchWithRetry: exhausted all attempts");
}

async function handleResponse<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
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
  const data = await handleResponse<{ space: CircleCourse } | CircleCourse>(res);
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
  return handleResponse<CircleSection>(res);
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
  return handleResponse<CircleLesson>(res);
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
  const res = await fetchWithRetry(
    `${BASE_URL}/course_sections?space_id=${spaceId}`,
    { method: "GET", headers: authHeaders(token) }
  );
  const data = await handleResponse<unknown>(res);
  if (Array.isArray(data)) return data as CircleSection[];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.course_sections)) return obj.course_sections as CircleSection[];
  return [];
}

export async function getCourseLessons(token: string, sectionId: number): Promise<CircleLesson[]> {
  const res = await fetchWithRetry(
    `${BASE_URL}/course_lessons?section_id=${sectionId}`,
    { method: "GET", headers: authHeaders(token) }
  );
  const data = await handleResponse<unknown>(res);
  if (Array.isArray(data)) return data as CircleLesson[];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.course_lessons)) return obj.course_lessons as CircleLesson[];
  return [];
}

export async function getLessonDetail(token: string, lessonId: number): Promise<CircleLessonDetail> {
  const res = await fetchWithRetry(
    `${BASE_URL}/course_lessons/${lessonId}`,
    { method: "GET", headers: authHeaders(token) }
  );
  const data = await handleResponse<unknown>(res);
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
  const res = await fetchWithRetry(
    `${BASE_URL}/direct_uploads`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ filename, byte_size: byteSize, content_type: contentType, checksum }),
    }
  );
  return handleResponse<DirectUploadResponse>(res);
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

export async function uploadToPresignedUrl(
  url: string,
  headers: Record<string, string>,
  data: ArrayBuffer
): Promise<void> {
  const res = await fetch(url, { method: "PUT", headers, body: data });
  if (!res.ok) {
    throw new Error(`File upload failed: ${res.status} ${res.statusText}`);
  }
}

// Aliases for alternate naming conventions
export const getSpaceSections = getCourseSections;
export const getSectionLessons = getCourseLessons;
