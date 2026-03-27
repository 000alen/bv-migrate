const BASE_URL = "https://app.circle.so/api/admin/v2";

const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  "User-Agent": "bv-migrate/1.0",
};

function authHeaders(token: string) {
  return {
    ...DEFAULT_HEADERS,
    Authorization: `Token ${token}`,
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Circle API error ${res.status}: ${res.statusText}`;
    try {
      const body = await res.json();
      if (body.message) message = `Circle API error: ${body.message}`;
      else if (body.error) message = `Circle API error: ${body.error}`;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

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

export async function createCourse(
  token: string,
  name: string,
  slug: string,
  spaceGroupId: number
): Promise<CircleCourse> {
  const res = await fetch(`${BASE_URL}/courses`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ name, slug, space_group_id: spaceGroupId }),
  });
  return handleResponse<CircleCourse>(res);
}

export async function createSection(
  token: string,
  spaceId: number,
  name: string
): Promise<CircleSection> {
  const res = await fetch(`${BASE_URL}/course_sections`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ name, course_id: spaceId }),
  });
  return handleResponse<CircleSection>(res);
}

export async function createLesson(
  token: string,
  sectionId: number,
  name: string,
  bodyHtml: string
): Promise<CircleLesson> {
  const res = await fetch(`${BASE_URL}/course_lessons`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      name,
      course_section_id: sectionId,
      body: bodyHtml,
    }),
  });
  return handleResponse<CircleLesson>(res);
}
