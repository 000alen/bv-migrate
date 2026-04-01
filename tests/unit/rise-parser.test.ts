import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { parseRiseExport } from "@/lib/rise-parser";
import { CourseStructureSchema } from "@/lib/schema";

/** Gitignored large binary — add `tests/fixtures/Milestone_1_C3.zip` locally to run these tests. */
const FIXTURE = path.resolve(__dirname, "../fixtures/Milestone_1_C3.zip");
const HAS_FIXTURE = fs.existsSync(FIXTURE);

describe.skipIf(!HAS_FIXTURE)("parseRiseExport (Milestone_1_C3 fixture)", () => {
  it("parses the Milestone_1_C3 fixture without throwing", async () => {
    const buf = fs.readFileSync(FIXTURE);
    const result = await parseRiseExport(buf);
    expect(result.course).toBeDefined();
    expect(result.images).toBeDefined();
    expect(result.warnings).toBeInstanceOf(Array);
  });

  it("produces a valid CourseStructure (passes Zod schema)", async () => {
    const buf = fs.readFileSync(FIXTURE);
    const { course } = await parseRiseExport(buf);
    const parsed = CourseStructureSchema.safeParse(course);
    expect(parsed.success).toBe(true);
  });

  it("sets course name from Rise title", async () => {
    const buf = fs.readFileSync(FIXTURE);
    const { course } = await parseRiseExport(buf);
    expect(course.name).toBe("MILESTONE 1: Purpose-Driven Problem Statement");
  });

  it("generates a non-empty slug", async () => {
    const buf = fs.readFileSync(FIXTURE);
    const { course } = await parseRiseExport(buf);
    expect(course.slug).toMatch(/^[a-z0-9-]+$/);
    expect(course.slug.length).toBeGreaterThan(0);
  });

  it("splits at continue blocks — produces 6 sections (5 continues + remainder)", async () => {
    const buf = fs.readFileSync(FIXTURE);
    const { course } = await parseRiseExport(buf);
    // Milestone 1 has 5 continue blocks → 6 section groups
    expect(course.sections.length).toBe(6);
  });

  it("every section has exactly one lesson", async () => {
    const buf = fs.readFileSync(FIXTURE);
    const { course } = await parseRiseExport(buf);
    for (const section of course.sections) {
      expect(section.lessons.length).toBe(1);
    }
  });

  it("every lesson has at least one block", async () => {
    const buf = fs.readFileSync(FIXTURE);
    const { course } = await parseRiseExport(buf);
    for (const section of course.sections) {
      for (const lesson of section.lessons) {
        expect(lesson.blocks.length).toBeGreaterThan(0);
      }
    }
  });

  it("produces heading blocks from text/heading paragraph blocks", async () => {
    const buf = fs.readFileSync(FIXTURE);
    const { course } = await parseRiseExport(buf);
    const allBlocks = course.sections.flatMap((s) => s.lessons.flatMap((l) => l.blocks));
    const headings = allBlocks.filter((b) => b.type === "heading");
    expect(headings.length).toBeGreaterThan(0);
    for (const h of headings) {
      expect(h.type).toBe("heading");
      if (h.type === "heading") {
        expect(h.text.length).toBeGreaterThan(0);
        expect([2, 3, 4]).toContain(h.level);
      }
    }
  });

  it("produces image_placeholder blocks for image blocks", async () => {
    const buf = fs.readFileSync(FIXTURE);
    const { course } = await parseRiseExport(buf);
    const allBlocks = course.sections.flatMap((s) => s.lessons.flatMap((l) => l.blocks));
    const imgs = allBlocks.filter((b) => b.type === "image_placeholder");
    // Milestone 1 has many image blocks (8, 11, 14, 20, 25, 27)
    expect(imgs.length).toBeGreaterThan(0);
  });

  it("produces checklist blocks from list/numbered blocks", async () => {
    const buf = fs.readFileSync(FIXTURE);
    const { course } = await parseRiseExport(buf);
    const allBlocks = course.sections.flatMap((s) => s.lessons.flatMap((l) => l.blocks));
    const lists = allBlocks.filter((b) => b.type === "checklist");
    expect(lists.length).toBeGreaterThanOrEqual(2); // items 6 and 22
  });

  it("produces flashcard block", async () => {
    const buf = fs.readFileSync(FIXTURE);
    const { course } = await parseRiseExport(buf);
    const allBlocks = course.sections.flatMap((s) => s.lessons.flatMap((l) => l.blocks));
    const flashcards = allBlocks.filter((b) => b.type === "flashcard");
    expect(flashcards.length).toBeGreaterThanOrEqual(1);
  });

  it("produces labeled_image block", async () => {
    const buf = fs.readFileSync(FIXTURE);
    const { course } = await parseRiseExport(buf);
    const allBlocks = course.sections.flatMap((s) => s.lessons.flatMap((l) => l.blocks));
    const labeled = allBlocks.filter((b) => b.type === "labeled_image");
    expect(labeled.length).toBeGreaterThanOrEqual(1);
  });

  it("produces quote blocks from quote/carousel", async () => {
    const buf = fs.readFileSync(FIXTURE);
    const { course } = await parseRiseExport(buf);
    const allBlocks = course.sections.flatMap((s) => s.lessons.flatMap((l) => l.blocks));
    const quotes = allBlocks.filter((b) => b.type === "quote");
    // Quote carousel with 3 slides → 3 quote blocks
    expect(quotes.length).toBeGreaterThanOrEqual(3);
  });

  it("produces survey_embed from multimedia/embed", async () => {
    const buf = fs.readFileSync(FIXTURE);
    const { course } = await parseRiseExport(buf);
    const allBlocks = course.sections.flatMap((s) => s.lessons.flatMap((l) => l.blocks));
    const embeds = allBlocks.filter((b) => b.type === "survey_embed");
    expect(embeds.length).toBeGreaterThanOrEqual(1);
    if (embeds[0].type === "survey_embed") {
      expect(embeds[0].description).toContain("typeform.com");
    }
  });

  it("produces file_attachment from multimedia/attachment", async () => {
    const buf = fs.readFileSync(FIXTURE);
    const { course } = await parseRiseExport(buf);
    const allBlocks = course.sections.flatMap((s) => s.lessons.flatMap((l) => l.blocks));
    const attachments = allBlocks.filter((b) => b.type === "file_attachment");
    expect(attachments.length).toBeGreaterThanOrEqual(1);
    if (attachments[0].type === "file_attachment") {
      expect(attachments[0].name).toContain("Milestone");
    }
  });

  it("resolves local images to buffers (not default backgrounds)", async () => {
    const buf = fs.readFileSync(FIXTURE);
    const { images } = await parseRiseExport(buf);
    const indices = Object.keys(images).map(Number);
    expect(indices.length).toBeGreaterThan(0);
    for (const idx of indices) {
      expect(images[idx].buffer).toBeInstanceOf(Buffer);
      expect(images[idx].buffer.length).toBeGreaterThan(0);
      expect(images[idx].filename).toBeTruthy();
      expect(images[idx].contentType).toMatch(/^image\//);
    }
  });

  it("skips Rise default background images (sourcedFrom=DEFAULT)", async () => {
    const buf = fs.readFileSync(FIXTURE);
    const { images } = await parseRiseExport(buf);
    for (const img of Object.values(images)) {
      // Default backgrounds: mountains.jpg, quote_background.jpg
      expect(img.filename).not.toMatch(/mountains|quote_background/i);
    }
  });

  it("image indices in CourseStructure match keys in images record", async () => {
    const buf = fs.readFileSync(FIXTURE);
    const { course, images } = await parseRiseExport(buf);
    const allBlocks = course.sections.flatMap((s) => s.lessons.flatMap((l) => l.blocks));
    const imgBlocks = allBlocks.filter((b) => b.type === "image_placeholder");
    const imageKeys = new Set(Object.keys(images).map(Number));
    for (const b of imgBlocks) {
      if (b.type === "image_placeholder") {
        // Each image_placeholder index should correspond to a loaded image
        expect(imageKeys.has(b.index)).toBe(true);
      }
    }
  });

  it("throws for a non-Rise ZIP (no deserialize call)", async () => {
    // Create a minimal fake ZIP-like buffer that won't have deserialize()
    // We'll use an actual valid-looking buffer but with wrong content
    const JSZip = await import("jszip");
    const zip = new JSZip.default();
    zip.file("index.html", "<html><body>not a rise export</body></html>");
    const fakeBuf = Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
    await expect(parseRiseExport(fakeBuf)).rejects.toThrow("No deserialize()");
  });

  it("does not include text blocks with only whitespace", async () => {
    const buf = fs.readFileSync(FIXTURE);
    const { course } = await parseRiseExport(buf);
    const allBlocks = course.sections.flatMap((s) => s.lessons.flatMap((l) => l.blocks));
    for (const b of allBlocks) {
      if (b.type === "text") {
        // Should have some stripped content
        const stripped = b.html.replace(/<[^>]+>/g, "").replace(/\s+/g, "").trim();
        expect(stripped.length).toBeGreaterThan(0);
      }
    }
  });
});
