import { describe, it, expect } from "vitest";
import { ContentBlockSchema } from "@/lib/schema";

// ─── Valid blocks ─────────────────────────────────────────────────────────────

describe("ContentBlockSchema — valid blocks", () => {
  it("text block", () => {
    expect(ContentBlockSchema.safeParse({ type: "text", html: "<p>Hello</p>" }).success).toBe(true);
  });

  it("heading level 2", () => {
    expect(ContentBlockSchema.safeParse({ type: "heading", level: 2, text: "Title" }).success).toBe(true);
  });

  it("heading level 3", () => {
    expect(ContentBlockSchema.safeParse({ type: "heading", level: 3, text: "Sub" }).success).toBe(true);
  });

  it("heading level 4", () => {
    expect(ContentBlockSchema.safeParse({ type: "heading", level: 4, text: "Sub-sub" }).success).toBe(true);
  });

  it("flashcard block", () => {
    expect(
      ContentBlockSchema.safeParse({
        type: "flashcard",
        cards: [{ front: "Q", back: "A" }],
      }).success
    ).toBe(true);
  });

  it("accordion block", () => {
    expect(
      ContentBlockSchema.safeParse({
        type: "accordion",
        tabs: [{ title: "Tab 1", content: "<p>Content</p>" }],
      }).success
    ).toBe(true);
  });

  it("quiz block", () => {
    expect(
      ContentBlockSchema.safeParse({
        type: "quiz",
        question: "What is 2+2?",
        options: ["3", "4", "5"],
        correctIndex: 1,
        feedbackCorrect: "Correct!",
        feedbackIncorrect: "Try again.",
      }).success
    ).toBe(true);
  });

  it("labeled_image block", () => {
    expect(
      ContentBlockSchema.safeParse({
        type: "labeled_image",
        description: "A diagram",
        labels: [{ title: "Label 1", content: "Explanation" }],
      }).success
    ).toBe(true);
  });

  it("sorting_activity block", () => {
    expect(
      ContentBlockSchema.safeParse({
        type: "sorting_activity",
        description: "Sort these",
        categories: [{ name: "Cat A", items: ["item1", "item2"] }],
      }).success
    ).toBe(true);
  });

  it("timeline block", () => {
    expect(
      ContentBlockSchema.safeParse({
        type: "timeline",
        description: "Events",
        steps: [{ title: "Step 1", content: "Details" }],
      }).success
    ).toBe(true);
  });

  it("padlet block", () => {
    expect(ContentBlockSchema.safeParse({ type: "padlet", description: "A padlet" }).success).toBe(true);
  });

  it("checklist block", () => {
    expect(ContentBlockSchema.safeParse({ type: "checklist", items: ["Do this", "Do that"] }).success).toBe(true);
  });

  it("button_stack block", () => {
    expect(
      ContentBlockSchema.safeParse({
        type: "button_stack",
        buttons: [{ label: "Click me", url: "https://example.com", description: "A button" }],
      }).success
    ).toBe(true);
  });

  it("image_placeholder block", () => {
    expect(
      ContentBlockSchema.safeParse({
        type: "image_placeholder",
        index: 0,
        description: "A photo",
      }).success
    ).toBe(true);
  });

  it("genially_placeholder block", () => {
    expect(
      ContentBlockSchema.safeParse({
        type: "genially_placeholder",
        name: "interactive-1",
        description: "An interactive",
      }).success
    ).toBe(true);
  });

  it("quote block", () => {
    expect(ContentBlockSchema.safeParse({ type: "quote", content: "A wise saying" }).success).toBe(true);
  });

  it("file_attachment block", () => {
    expect(
      ContentBlockSchema.safeParse({
        type: "file_attachment",
        name: "report.pdf",
        description: "Annual report",
      }).success
    ).toBe(true);
  });

  it("survey_embed block", () => {
    expect(ContentBlockSchema.safeParse({ type: "survey_embed", description: "A survey" }).success).toBe(true);
  });

  it("divider block", () => {
    expect(ContentBlockSchema.safeParse({ type: "divider" }).success).toBe(true);
  });
});

// ─── Missing required fields ──────────────────────────────────────────────────

describe("ContentBlockSchema — missing required fields", () => {
  it("text missing html", () => {
    expect(ContentBlockSchema.safeParse({ type: "text" }).success).toBe(false);
  });

  it("heading missing text", () => {
    expect(ContentBlockSchema.safeParse({ type: "heading", level: 2 }).success).toBe(false);
  });

  it("heading missing level", () => {
    expect(ContentBlockSchema.safeParse({ type: "heading", text: "Title" }).success).toBe(false);
  });

  it("heading invalid level (1)", () => {
    expect(ContentBlockSchema.safeParse({ type: "heading", level: 1, text: "H1" }).success).toBe(false);
  });

  it("heading invalid level (5)", () => {
    expect(ContentBlockSchema.safeParse({ type: "heading", level: 5, text: "H5" }).success).toBe(false);
  });

  it("flashcard missing cards", () => {
    expect(ContentBlockSchema.safeParse({ type: "flashcard" }).success).toBe(false);
  });

  it("flashcard card missing front", () => {
    expect(
      ContentBlockSchema.safeParse({ type: "flashcard", cards: [{ back: "A" }] }).success
    ).toBe(false);
  });

  it("quiz missing question", () => {
    expect(
      ContentBlockSchema.safeParse({
        type: "quiz",
        options: ["A"],
        correctIndex: 0,
        feedbackCorrect: "OK",
        feedbackIncorrect: "No",
      }).success
    ).toBe(false);
  });

  it("quiz missing feedbackCorrect", () => {
    expect(
      ContentBlockSchema.safeParse({
        type: "quiz",
        question: "Q?",
        options: ["A"],
        correctIndex: 0,
        feedbackIncorrect: "No",
      }).success
    ).toBe(false);
  });

  it("image_placeholder missing index", () => {
    expect(
      ContentBlockSchema.safeParse({ type: "image_placeholder", description: "img" }).success
    ).toBe(false);
  });

  it("genially_placeholder missing name", () => {
    expect(
      ContentBlockSchema.safeParse({ type: "genially_placeholder", description: "gen" }).success
    ).toBe(false);
  });

  it("quote missing content", () => {
    expect(ContentBlockSchema.safeParse({ type: "quote" }).success).toBe(false);
  });

  it("file_attachment missing description", () => {
    expect(ContentBlockSchema.safeParse({ type: "file_attachment", name: "file.pdf" }).success).toBe(false);
  });
});

// ─── quiz correctIndex bounds ─────────────────────────────────────────────────

describe("ContentBlockSchema — quiz correctIndex bounds", () => {
  const base = {
    type: "quiz" as const,
    question: "Q?",
    options: ["A", "B", "C"],
    feedbackCorrect: "Yes",
    feedbackIncorrect: "No",
  };

  it("negative correctIndex is rejected", () => {
    expect(ContentBlockSchema.safeParse({ ...base, correctIndex: -1 }).success).toBe(false);
  });

  it("zero correctIndex is accepted", () => {
    expect(ContentBlockSchema.safeParse({ ...base, correctIndex: 0 }).success).toBe(true);
  });

  it("correctIndex too high (beyond options.length) is rejected by schema", () => {
    // FIXED: schema now has a .refine() that validates correctIndex < options.length
    expect(ContentBlockSchema.safeParse({ ...base, correctIndex: 99 }).success).toBe(false);
  });

  it("non-integer correctIndex is rejected", () => {
    expect(ContentBlockSchema.safeParse({ ...base, correctIndex: 1.5 }).success).toBe(false);
  });

  it("image_placeholder negative index is rejected", () => {
    expect(
      ContentBlockSchema.safeParse({ type: "image_placeholder", index: -1, description: "img" }).success
    ).toBe(false);
  });
});

// ─── Empty arrays ─────────────────────────────────────────────────────────────

describe("ContentBlockSchema — empty arrays are rejected", () => {
  it("flashcard with empty cards array is rejected", () => {
    // FIXED: .min(1) on cards
    expect(ContentBlockSchema.safeParse({ type: "flashcard", cards: [] }).success).toBe(false);
  });

  it("accordion with empty tabs array is rejected", () => {
    // FIXED: .min(1) on tabs
    expect(ContentBlockSchema.safeParse({ type: "accordion", tabs: [] }).success).toBe(false);
  });

  it("quiz with empty options array is rejected", () => {
    // FIXED: .min(2) on options (need at least 2 choices for a quiz)
    expect(
      ContentBlockSchema.safeParse({
        type: "quiz",
        question: "Q?",
        options: [],
        correctIndex: 0,
        feedbackCorrect: "Yes",
        feedbackIncorrect: "No",
      }).success
    ).toBe(false);
  });

  it("quiz with only 1 option is rejected", () => {
    expect(
      ContentBlockSchema.safeParse({
        type: "quiz",
        question: "Q?",
        options: ["Only one"],
        correctIndex: 0,
        feedbackCorrect: "Yes",
        feedbackIncorrect: "No",
      }).success
    ).toBe(false);
  });

  it("checklist with empty items array is rejected", () => {
    // FIXED: .min(1) on checklist items
    expect(ContentBlockSchema.safeParse({ type: "checklist", items: [] }).success).toBe(false);
  });

  it("button_stack with empty buttons array is rejected", () => {
    // FIXED: .min(1) on button_stack buttons
    expect(ContentBlockSchema.safeParse({ type: "button_stack", buttons: [] }).success).toBe(false);
  });
});

// ─── Invalid discriminator ────────────────────────────────────────────────────

describe("ContentBlockSchema — invalid discriminator", () => {
  it("unknown type is rejected", () => {
    expect(ContentBlockSchema.safeParse({ type: "unknown_type" }).success).toBe(false);
  });

  it("missing type entirely is rejected", () => {
    expect(ContentBlockSchema.safeParse({ html: "<p>No type</p>" }).success).toBe(false);
  });

  it("null type is rejected", () => {
    expect(ContentBlockSchema.safeParse({ type: null }).success).toBe(false);
  });
});
