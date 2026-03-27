/**
 * Deterministic test course structure for integration tests.
 *
 * The course body is always identical (same blocks, same content) so that
 * HTML verification is reliable. The name/slug embed a caller-supplied label
 * (typically Date.now()) to ensure uniqueness across runs.
 *
 * Block coverage:
 *   Section 1 / Lesson 1 — text, heading, image_placeholder
 *   Section 1 / Lesson 2 — quiz, flashcard
 *   Section 2 / Lesson 3 — genially_placeholder
 *   Section 2 / Lesson 4 — heading, text
 */

import { CourseStructure } from "@/lib/schema";
import { buildHtml } from "@/lib/html-builder";
import { TEST_PREFIX } from "../config";

export function makeTestCourse(label: string | number = Date.now()): CourseStructure {
  return {
    name: `${TEST_PREFIX}${label}`,
    slug: `test-bv-migrate-${label}`,
    sections: [
      {
        name: "Unit 1 — Fundamentals",
        lessons: [
          {
            name: "Lesson 1 — Text and Headings",
            blocks: [
              { type: "heading", level: 2, text: "Welcome to the test course" },
              { type: "text", html: "<p>This is integration test content.</p>" },
              {
                type: "image_placeholder",
                index: 1,
                description: "Test diagram",
              },
            ],
          },
          {
            name: "Lesson 2 — Quiz and Flashcard",
            blocks: [
              {
                type: "quiz",
                question: "What is 2 + 2?",
                options: ["3", "4", "5"],
                correctIndex: 1,
                feedbackCorrect: "Correct!",
                feedbackIncorrect: "Try again.",
              },
              {
                type: "flashcard",
                cards: [
                  {
                    front: "What is integration testing?",
                    back: "Testing components together in a real environment.",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        name: "Unit 2 — Interactives",
        lessons: [
          {
            name: "Lesson 3 — Genially Placeholder",
            blocks: [
              {
                type: "genially_placeholder",
                name: "test-interactive-1",
                description: "A test Genially interactive activity",
              },
            ],
          },
          {
            name: "Lesson 4 — Summary",
            blocks: [
              { type: "heading", level: 3, text: "Summary" },
              { type: "text", html: "<p>That concludes the test course.</p>" },
            ],
          },
        ],
      },
    ],
  };
}

/**
 * Expected HTML output for Lesson 1 blocks, built via html-builder.
 * Used to verify body_html stored in Circle matches what the import route sent.
 */
export function expectedLesson1Html(): string {
  return buildHtml([
    { type: "heading", level: 2, text: "Welcome to the test course" },
    { type: "text", html: "<p>This is integration test content.</p>" },
    { type: "image_placeholder", index: 1, description: "Test diagram" },
  ]);
}
