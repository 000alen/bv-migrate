import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createCourse,
  createSection,
  createLesson,
  getCourseSections,
  getCourseLessons,
  getLessonDetail,
} from "@/lib/circle";

// ─── Mock fetch ───────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── createCourse ─────────────────────────────────────────────────────────────

describe("createCourse", () => {
  it("sends POST to /spaces with correct body", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ space: { id: 42, name: "Test", slug: "test" } }));

    const result = await createCourse("tok123", "Test", "test", 999);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("/spaces");
    const body = JSON.parse(init.body);
    expect(body.space_type).toBe("course");
    expect(body.space_group_id).toBe(999);
    expect(body.name).toBe("Test");
    expect(result.id).toBe(42);
  });

  it("unwraps { space: ... } wrapper", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ space: { id: 1, name: "X", slug: "x" } }));
    const result = await createCourse("tok", "X", "x", 1);
    expect(result.id).toBe(1);
  });

  it("handles flat response (no wrapper)", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 2, name: "Y", slug: "y" }));
    const result = await createCourse("tok", "Y", "y", 1);
    expect(result.id).toBe(2);
  });

  it("includes User-Agent header", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ space: { id: 1, name: "X", slug: "x" } }));
    await createCourse("tok", "X", "x", 1);
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["User-Agent"]).toContain("bv-migrate");
  });
});

// ─── createSection ────────────────────────────────────────────────────────────

describe("createSection", () => {
  it("sends space_id (not course_id)", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 10, name: "Sec1" }));

    await createSection("tok", 42, "Sec1");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.space_id).toBe(42);
    expect(body.course_id).toBeUndefined();
  });
});

// ─── createLesson ─────────────────────────────────────────────────────────────

describe("createLesson", () => {
  it("sends section_id, body_html, and status:draft", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 20, name: "Lesson1" }));

    await createLesson("tok", 10, "Lesson1", "<p>Content</p>");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.section_id).toBe(10);
    expect(body.body_html).toBe("<p>Content</p>");
    expect(body.status).toBe("draft");
    expect(body.course_section_id).toBeUndefined();
  });
});

// ─── Retry logic ──────────────────────────────────────────────────────────────

describe("fetchWithRetry (via createCourse)", () => {
  it("retries on 429 with backoff", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(jsonResponse({ space: { id: 1, name: "X", slug: "x" } }));

    const result = await createCourse("tok", "X", "x", 1);
    expect(result.id).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("retries on 500", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response("error", { status: 500 }))
      .mockResolvedValueOnce(jsonResponse({ space: { id: 1, name: "X", slug: "x" } }));

    const result = await createCourse("tok", "X", "x", 1);
    expect(result.id).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws after max attempts", async () => {
    mockFetch
      .mockResolvedValue(new Response("error", { status: 500 }));

    await expect(createCourse("tok", "X", "x", 1)).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalledTimes(4); // default maxAttempts
  }, 120_000);

  it("respects Retry-After header on 429", async () => {
    const rateLimitResponse = new Response("rate limited", {
      status: 429,
      headers: { "Retry-After": "1" },
    });
    mockFetch
      .mockResolvedValueOnce(rateLimitResponse)
      .mockResolvedValueOnce(jsonResponse({ space: { id: 1, name: "X", slug: "x" } }));

    const start = Date.now();
    await createCourse("tok", "X", "x", 1);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(900); // ~1 second
  });

  it("throws on 4xx (non-429) without retry", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 })
    );

    await expect(createCourse("tok", "X", "x", 1)).rejects.toThrow("Forbidden");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries on 'Missing record. Please try again later' (422)", async () => {
    const missingRecord = new Response(
      JSON.stringify({ message: "Oops! Missing record. Please try again later." }),
      { status: 422 }
    );
    mockFetch
      .mockResolvedValueOnce(missingRecord)
      .mockResolvedValueOnce(jsonResponse({ space: { id: 1, name: "X", slug: "x" } }));

    const result = await createCourse("tok", "X", "x", 1);
    expect(result.id).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws after max retries on persistent 'Missing record'", async () => {
    const makeMissing = () => new Response(
      JSON.stringify({ message: "Oops! Missing record. Please try again later." }),
      { status: 422 }
    );
    mockFetch
      .mockResolvedValueOnce(makeMissing())
      .mockResolvedValueOnce(makeMissing())
      .mockResolvedValueOnce(makeMissing())
      .mockResolvedValueOnce(makeMissing())
      .mockResolvedValueOnce(makeMissing());

    await expect(createCourse("tok", "X", "x", 1)).rejects.toThrow("Missing record");
    expect(mockFetch).toHaveBeenCalledTimes(4); // default maxAttempts
  }, 120_000);
});

// ─── getCourseSections pagination ─────────────────────────────────────────────

describe("getCourseSections", () => {
  it("paginates when has_next_page is true", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({
        records: [{ id: 1, name: "S1" }],
        has_next_page: true,
        page: 1,
      }))
      .mockResolvedValueOnce(jsonResponse({
        records: [{ id: 2, name: "S2" }],
        has_next_page: false,
        page: 2,
      }));

    const sections = await getCourseSections("tok", 42);
    expect(sections).toHaveLength(2);
    expect(sections[0].name).toBe("S1");
    expect(sections[1].name).toBe("S2");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("handles single page", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      records: [{ id: 1, name: "S1" }],
      has_next_page: false,
    }));

    const sections = await getCourseSections("tok", 42);
    expect(sections).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("uses GET method without Content-Type", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ records: [], has_next_page: false }));
    await getCourseSections("tok", 42);
    const init = mockFetch.mock.calls[0][1];
    expect(init.method).toBe("GET");
    expect(init.headers["Content-Type"]).toBeUndefined();
  });
});

// ─── getLessonDetail ──────────────────────────────────────────────────────────

describe("getLessonDetail", () => {
  it("unwraps { course_lesson: ... } wrapper", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      course_lesson: { id: 5, name: "L5", body_html: "<p>Hello</p>" },
    }));

    const detail = await getLessonDetail("tok", 5);
    expect(detail.id).toBe(5);
    expect(detail.body_html).toBe("<p>Hello</p>");
  });

  it("handles flat response", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      id: 6, name: "L6", body_html: "<p>World</p>",
    }));

    const detail = await getLessonDetail("tok", 6);
    expect(detail.id).toBe(6);
  });
});
