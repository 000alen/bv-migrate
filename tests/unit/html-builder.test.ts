import { describe, it, expect } from "vitest";
import { buildHtml } from "@/lib/html-builder";
import type { ContentBlock } from "@/lib/schema";

describe("buildHtml", () => {
  it("text block passes HTML through without escaping", () => {
    const blocks: ContentBlock[] = [{ type: "text", html: "<p><strong>Bold</strong> & <em>italic</em></p>" }];
    expect(buildHtml(blocks)).toBe("<p><strong>Bold</strong> & <em>italic</em></p>");
  });

  it("heading escapes text content", () => {
    const blocks: ContentBlock[] = [{ type: "heading", level: 3, text: "Title with <script>" }];
    const html = buildHtml(blocks);
    expect(html).toContain("<h3>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("heading uses correct level", () => {
    expect(buildHtml([{ type: "heading", level: 2, text: "H2" }])).toContain("<h2>");
    expect(buildHtml([{ type: "heading", level: 4, text: "H4" }])).toContain("<h4>");
  });

  it("flashcard renders front/back in blockquote", () => {
    const html = buildHtml([{ type: "flashcard", cards: [{ front: "Q", back: "<p>A</p>" }] }]);
    expect(html).toContain("<blockquote>");
    expect(html).toContain("💡 Q");
    expect(html).toContain("<p>A</p>"); // back is HTML, not escaped
  });

  it("accordion renders tabs with title escaped, content as HTML", () => {
    const html = buildHtml([{ type: "accordion", tabs: [{ title: "Tab <1>", content: "<p>Content</p>" }] }]);
    expect(html).toContain("▸ Tab &lt;1&gt;");
    expect(html).toContain("<p>Content</p>");
  });

  it("quiz marks correct answer with ✓", () => {
    const html = buildHtml([{
      type: "quiz",
      question: "What?",
      options: ["A", "B", "C"],
      correctIndex: 1,
      feedbackCorrect: "Yes!",
      feedbackIncorrect: "No!",
    }]);
    expect(html).toContain("❓ What?");
    expect(html).toContain("<li>A</li>");
    expect(html).toContain("<li>B ✓</li>");
    expect(html).toContain("<li>C</li>");
    expect(html).toContain("✅");
    expect(html).toContain("❌");
  });

  it("genially_placeholder with URL produces iframe", () => {
    const html = buildHtml(
      [{ type: "genially_placeholder", name: "gen1", description: "Interactive" }],
      { gen1: "https://view.genially.com/abc" }
    );
    expect(html).toContain("<iframe");
    expect(html).toContain("https://view.genially.com/abc");
  });

  it("genially_placeholder without URL produces text placeholder", () => {
    const html = buildHtml([{ type: "genially_placeholder", name: "gen1", description: "Interactive" }]);
    expect(html).toContain("[INTERACTIVE: gen1]");
    expect(html).not.toContain("<iframe");
  });

  it("image_placeholder renders with index and description", () => {
    const html = buildHtml([{ type: "image_placeholder", index: 3, description: "A photo" }]);
    expect(html).toContain("[IMAGE 3: A photo]");
  });

  it("labeled_image renders description and labels", () => {
    const html = buildHtml([{
      type: "labeled_image",
      description: "Diagram",
      labels: [{ title: "Part A", content: "<p>Details</p>" }],
    }]);
    expect(html).toContain("[IMAGE: Diagram]");
    expect(html).toContain("Part A");
    expect(html).toContain("<p>Details</p>");
  });

  it("sorting_activity renders categories and items", () => {
    const html = buildHtml([{
      type: "sorting_activity",
      description: "Sort",
      categories: [{ name: "Cat A", items: ["item1", "item2"] }],
    }]);
    expect(html).toContain("[SORTING ACTIVITY: Sort]");
    expect(html).toContain("Cat A");
    expect(html).toContain("item1");
  });

  it("timeline renders steps", () => {
    const html = buildHtml([{
      type: "timeline",
      description: "History",
      steps: [{ title: "2020", content: "<p>Event</p>" }],
    }]);
    expect(html).toContain("[TIMELINE: History]");
    expect(html).toContain("2020");
  });

  it("checklist renders items with checkboxes", () => {
    const html = buildHtml([{ type: "checklist", items: ["Do X", "Do Y"] }]);
    expect(html).toContain("☐ Do X");
    expect(html).toContain("☐ Do Y");
    expect(html).toContain("<ul>");
  });

  it("button_stack renders links", () => {
    const html = buildHtml([{
      type: "button_stack",
      buttons: [{ label: "Click", url: "https://example.com", description: "A link" }],
    }]);
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("Click");
  });

  it("quote renders in blockquote, content as HTML", () => {
    const html = buildHtml([{ type: "quote", content: "<p>Wise words</p>" }]);
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<p>Wise words</p>");
  });

  it("padlet renders placeholder", () => {
    const html = buildHtml([{ type: "padlet", description: "My padlet" }]);
    expect(html).toContain("[PADLET: My padlet]");
  });

  it("file_attachment renders name and description", () => {
    const html = buildHtml([{ type: "file_attachment", name: "report.pdf", description: "Annual report" }]);
    expect(html).toContain("📎");
    expect(html).toContain("report.pdf");
  });

  it("survey_embed renders placeholder", () => {
    const html = buildHtml([{ type: "survey_embed", description: "A survey" }]);
    expect(html).toContain("[SURVEY: A survey]");
  });

  it("divider renders <hr>", () => {
    expect(buildHtml([{ type: "divider" }])).toBe("<hr>");
  });

  it("empty blocks array returns empty string", () => {
    expect(buildHtml([])).toBe("");
  });

  it("multiple blocks joined with double newline", () => {
    const html = buildHtml([
      { type: "heading", level: 2, text: "Title" },
      { type: "text", html: "<p>Body</p>" },
    ]);
    expect(html).toContain("<h2>Title</h2>\n\n<p>Body</p>");
  });

  it("geniallyUrls parameter is optional", () => {
    // Should not throw when omitted
    const html = buildHtml([{ type: "genially_placeholder", name: "gen1", description: "test" }]);
    expect(html).toContain("[INTERACTIVE: gen1]");
  });
});
