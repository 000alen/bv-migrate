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
