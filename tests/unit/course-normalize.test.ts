import { describe, it, expect } from "vitest";
import { normalizeCourseStructure } from "@/lib/course-normalize";
import { CourseStructureSchema } from "@/lib/schema";

describe("normalizeCourseStructure", () => {
  it("coerces quiz correctIndex from string and fixes heading level", () => {
    const raw = {
      name: "M",
      slug: "m",
      sections: [
        {
          name: "S",
          lessons: [
            {
              name: "L",
              blocks: [
                {
                  type: "quiz",
                  question: "Q?",
                  options: ["a", "b"],
                  correctIndex: "1",
                  feedbackCorrect: "y",
                  feedbackIncorrect: "n",
                },
                { type: "heading", level: 9, text: "H" },
              ],
            },
          ],
        },
      ],
    };
    const n = normalizeCourseStructure(raw);
    const parsed = CourseStructureSchema.safeParse(n);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const quiz = parsed.data.sections[0]!.lessons[0]!.blocks[0]!;
      expect(quiz.type).toBe("quiz");
      if (quiz.type === "quiz") expect(quiz.correctIndex).toBe(1);
      const h = parsed.data.sections[0]!.lessons[0]!.blocks[1]!;
      expect(h.type).toBe("heading");
      if (h.type === "heading") expect(h.level).toBe(4);
    }
  });

  it("maps unknown block types to text", () => {
    const raw = {
      name: "M",
      slug: "m",
      sections: [
        {
          name: "S",
          lessons: [{ name: "L", blocks: [{ type: "weird_block", foo: 1 }] }],
        },
      ],
    };
    const n = normalizeCourseStructure(raw);
    const parsed = CourseStructureSchema.safeParse(n);
    expect(parsed.success).toBe(true);
  });
});
