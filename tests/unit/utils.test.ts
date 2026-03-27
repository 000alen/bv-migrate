import { describe, it, expect, vi, beforeEach } from "vitest";
import { collectBlocks, downloadJson } from "@/lib/utils";
import type { CourseStructure } from "@/lib/schema";

const TEST_COURSE: CourseStructure = {
  name: "Test Course",
  slug: "test-course",
  sections: [
    {
      name: "Section 1",
      lessons: [
        {
          name: "Lesson 1",
          blocks: [
            { type: "text", html: "<p>Hello</p>" },
            { type: "image_placeholder", index: 1, description: "Photo 1" },
            { type: "quiz", question: "Q?", options: ["A", "B"], correctIndex: 0, feedbackCorrect: "Y", feedbackIncorrect: "N" },
          ],
        },
        {
          name: "Lesson 2",
          blocks: [
            { type: "image_placeholder", index: 2, description: "Photo 2" },
            { type: "genially_placeholder", name: "gen1", description: "Interactive" },
          ],
        },
      ],
    },
    {
      name: "Section 2",
      lessons: [
        {
          name: "Lesson 3",
          blocks: [
            { type: "text", html: "<p>More</p>" },
            { type: "image_placeholder", index: 3, description: "Photo 3" },
          ],
        },
      ],
    },
  ],
};

describe("collectBlocks", () => {
  it("finds all image_placeholder blocks across sections", () => {
    const result = collectBlocks(TEST_COURSE, "image_placeholder");
    expect(result).toHaveLength(3);
    expect(result[0].block.index).toBe(1);
    expect(result[0].section).toBe("Section 1");
    expect(result[0].lesson).toBe("Lesson 1");
    expect(result[2].block.index).toBe(3);
    expect(result[2].section).toBe("Section 2");
  });

  it("finds genially_placeholder blocks", () => {
    const result = collectBlocks(TEST_COURSE, "genially_placeholder");
    expect(result).toHaveLength(1);
    expect(result[0].block.name).toBe("gen1");
    expect(result[0].lesson).toBe("Lesson 2");
  });

  it("finds quiz blocks", () => {
    const result = collectBlocks(TEST_COURSE, "quiz");
    expect(result).toHaveLength(1);
    expect(result[0].block.question).toBe("Q?");
  });

  it("returns empty array for type not present", () => {
    const result = collectBlocks(TEST_COURSE, "padlet");
    expect(result).toEqual([]);
  });

  it("returns empty for course with no sections", () => {
    const empty: CourseStructure = { name: "Empty", slug: "empty", sections: [] };
    expect(collectBlocks(empty, "text")).toEqual([]);
  });

  it("returns empty for sections with no lessons", () => {
    const noLessons: CourseStructure = {
      name: "No Lessons",
      slug: "no-lessons",
      sections: [{ name: "S1", lessons: [] }],
    };
    expect(collectBlocks(noLessons, "text")).toEqual([]);
  });
});

describe("downloadJson", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates blob, triggers download, revokes URL", () => {
    const mockUrl = "blob:test-url";
    const createObjectURL = vi.fn(() => mockUrl);
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    const clickSpy = vi.fn();
    vi.spyOn(document, "createElement").mockReturnValue({
      set href(_: string) {},
      get href() { return ""; },
      set download(_: string) {},
      click: clickSpy,
    } as unknown as HTMLAnchorElement);

    downloadJson({ key: "value" }, "test.json");

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith(mockUrl);
  });
});
