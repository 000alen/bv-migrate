import JSZip from "jszip";
import { CourseStructureSchema } from "@/lib/schema";
import type { CourseStructure, ContentBlock } from "@/lib/schema";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface RiseImage {
  filename: string;
  buffer: Buffer;
  contentType: string;
}

export interface RiseParseResult {
  course: CourseStructure;
  images: Record<number, RiseImage>;
  warnings: string[];
}

// ─── Internal Rise data types ─────────────────────────────────────────────────

interface RiseImageData {
  key?: string;
  originalUrl?: string;
  sourcedFrom?: string;
}

interface RiseMediaItem {
  media?: {
    image?: RiseImageData;
    embed?: { originalUrl?: string; src?: string; title?: string };
    attachment?: { originalUrl?: string; mimeType?: string; size?: number };
  };
  heading?: string;
  paragraph?: string;
  caption?: string;
  // flashcard fields
  front?: { type?: string; description?: string; media?: { image?: RiseImageData } };
  back?: { description?: string; media?: { image?: RiseImageData } };
  // labeled graphic
  x?: string;
  y?: string;
  icon?: string;
  title?: string;
  description?: string;
  // quote
  name?: string;
  avatar?: { media?: { image?: RiseImageData } };
}

interface RiseBlock {
  id: string;
  type: string;
  family: string;
  variant: string;
  items: RiseMediaItem[];
}

interface RiseCourse {
  title: string;
  lessons: Array<{ title: string; items: RiseBlock[] }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns true if the HTML div wrapper is empty / placeholder-only */
function isEmptyHeading(html: string): boolean {
  return !html || stripHtml(html).length === 0 || stripHtml(html) === "Heading";
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Content-type from extension */
function mimeFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
  };
  return map[ext] ?? "application/octet-stream";
}

/** Resolve a Rise image reference to a ZIP entry path */
function resolveImagePath(
  img: RiseImageData,
  assetPaths: Set<string>,
  baseDir: string
): string | null {
  // Skip Rise default backgrounds
  if (img.sourcedFrom === "DEFAULT") return null;
  if (img.key?.startsWith("assets/rise/assets/")) return null;

  // Primary strategy: use originalUrl
  const candidates: string[] = [];
  if (img.originalUrl) {
    const decoded = decodeURIComponent(img.originalUrl);
    candidates.push(`${baseDir}assets/${decoded}`);
    candidates.push(`${baseDir}assets/${img.originalUrl}`);
  }
  // Fallback: try the key itself
  if (img.key && !img.key.startsWith("rise/courses/")) {
    const decoded = decodeURIComponent(img.key);
    candidates.push(`${baseDir}assets/${decoded}`);
    candidates.push(`${baseDir}assets/${img.key}`);
  }

  for (const c of candidates) {
    if (assetPaths.has(c)) return c;
  }
  return null;
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export async function parseRiseExport(zipBuffer: Buffer): Promise<RiseParseResult> {
  const warnings: string[] = [];

  // 1. Load ZIP
  const zip = await JSZip.loadAsync(zipBuffer);

  // 2. Find index.html (may be inside a subdirectory)
  let indexEntry: JSZip.JSZipObject | null = null;
  let baseDir = "";
  for (const [path, entry] of Object.entries(zip.files)) {
    if (!entry.dir && path.endsWith("/index.html") && !path.includes("__MACOSX")) {
      indexEntry = entry;
      baseDir = path.replace("index.html", "");
      break;
    }
    if (path === "index.html") {
      indexEntry = entry;
      baseDir = "";
      break;
    }
  }
  if (!indexEntry) throw new Error("No index.html found in ZIP");

  // 3. Extract course JSON from deserialize("BASE64")
  const html = await indexEntry.async("string");
  const match = html.match(/deserialize\("([A-Za-z0-9+/=]+)"\)/);
  if (!match) throw new Error("No deserialize() call found in index.html — not a Rise export");

  const courseJson = Buffer.from(match[1], "base64").toString("utf-8");
  const rawData = JSON.parse(courseJson) as { course: RiseCourse };
  const riseCourse = rawData.course;

  // 4. Build a set of all asset paths in the ZIP for fast lookup
  const assetPaths = new Set<string>();
  for (const path of Object.keys(zip.files)) {
    if (!zip.files[path].dir) assetPaths.add(path);
  }

  // 5. Parse all lessons — collect blocks, split at continue boundaries
  const allItems: RiseBlock[] = [];
  for (const lesson of riseCourse.lessons) {
    allItems.push(...lesson.items);
  }

  // 6. Group items into sections (split at `continue` blocks)
  const sectionGroups: RiseBlock[][] = [];
  let current: RiseBlock[] = [];
  for (const item of allItems) {
    if (item.family === "continue") {
      sectionGroups.push(current);
      current = [];
    } else {
      current.push(item);
    }
  }
  sectionGroups.push(current);

  // 7. Convert each section group to ContentBlocks
  let imageCounter = 0;
  const images: Record<number, RiseImage> = {};

  async function loadImage(img: RiseImageData, context: string): Promise<number | null> {
    const path = resolveImagePath(img, assetPaths, baseDir);
    if (!path) {
      warnings.push(`Image not found in ZIP: ${img.originalUrl ?? img.key ?? "unknown"} (${context})`);
      return null;
    }
    const buf = await zip.files[path].async("nodebuffer");
    const filename = path.split("/").pop() ?? "image";
    const idx = imageCounter++;
    images[idx] = {
      filename,
      buffer: buf,
      contentType: mimeFromFilename(filename),
    };
    return idx;
  }

  async function mapBlock(item: RiseBlock): Promise<ContentBlock[]> {
    const { family, variant, items } = item;
    const d = items[0] as RiseMediaItem | undefined;

    // ── text/paragraph ────────────────────────────────────────────────────────
    if (family === "text" && variant === "paragraph") {
      if (!d) return [];
      const blocks: ContentBlock[] = [];
      if (d.heading && !isEmptyHeading(d.heading)) {
        blocks.push({ type: "heading", level: 3, text: stripHtml(d.heading) });
      }
      if (d.paragraph && stripHtml(d.paragraph).length > 0) {
        blocks.push({ type: "text", html: d.paragraph });
      }
      return blocks;
    }

    // ── text/heading paragraph ─────────────────────────────────────────────────
    if (family === "text" && variant === "heading paragraph") {
      if (!d) return [];
      const blocks: ContentBlock[] = [];
      if (d.heading && !isEmptyHeading(d.heading)) {
        blocks.push({ type: "heading", level: 3, text: stripHtml(d.heading) });
      }
      if (d.paragraph && stripHtml(d.paragraph).length > 0) {
        blocks.push({ type: "text", html: d.paragraph });
      }
      return blocks;
    }

    // ── impact/note ────────────────────────────────────────────────────────────
    if (family === "impact") {
      if (!d?.paragraph) return [];
      return [{ type: "text", html: `<div class="callout">${d.paragraph}</div>` }];
    }

    // ── interactive-fullscreen/labeledgraphic ──────────────────────────────────
    if (family === "interactive-fullscreen" && variant === "labeledgraphic") {
      const labels = items
        .filter((m) => m.title || m.description)
        .map((m) => ({
          title: stripHtml(m.title ?? ""),
          content: stripHtml(m.description ?? ""),
        }));
      if (labels.length === 0) return [];
      return [{ type: "labeled_image", description: "", labels }];
    }

    // ── flashcard/flashcard ────────────────────────────────────────────────────
    if (family === "flashcard") {
      const cards = items
        .map((m) => {
          const front = m.front?.description
            ? stripHtml(m.front.description)
            : m.front?.type === "fullimage"
            ? "[Image card front]"
            : "Front of card";
          const back = m.back?.description ? stripHtml(m.back.description) : "";
          return { front, back };
        })
        .filter((c) => c.front || c.back);
      if (cards.length === 0) return [];
      return [{ type: "flashcard", cards }];
    }

    // ── list/numbered ──────────────────────────────────────────────────────────
    if (family === "list") {
      const listItems = items
        .map((m) => (m.paragraph ? stripHtml(m.paragraph) : ""))
        .filter(Boolean);
      if (listItems.length === 0) return [];
      return [{ type: "checklist", items: listItems }];
    }

    // ── image/full, image/hero ────────────────────────────────────────────────
    if (family === "image" && (variant === "full" || variant === "hero")) {
      const img = d?.media?.image;
      if (!img) return [];
      const idx = await loadImage(img, `image/${variant}`);
      if (idx === null) {
        return [{ type: "image_placeholder", index: imageCounter++, description: d?.caption ?? "" }];
      }
      return [{ type: "image_placeholder", index: idx, description: d?.caption ?? "" }];
    }

    // ── image/text aside ──────────────────────────────────────────────────────
    if (family === "image" && variant === "text aside") {
      const blocks: ContentBlock[] = [];
      const img = d?.media?.image;
      if (img) {
        const idx = await loadImage(img, "image/text aside");
        if (idx === null) {
          blocks.push({ type: "image_placeholder", index: imageCounter++, description: "" });
        } else {
          blocks.push({ type: "image_placeholder", index: idx, description: "" });
        }
      }
      if (d?.paragraph && stripHtml(d.paragraph).length > 0) {
        blocks.push({ type: "text", html: d.paragraph });
      }
      return blocks;
    }

    // ── quote/carousel ────────────────────────────────────────────────────────
    if (family === "quote") {
      return items
        .filter((m) => m.paragraph)
        .map((m) => ({ type: "quote" as const, content: stripHtml(m.paragraph!) }));
    }

    // ── multimedia/embed ──────────────────────────────────────────────────────
    if (family === "multimedia" && variant === "embed") {
      const embed = d?.media?.embed;
      if (!embed) return [];
      const url = embed.originalUrl ?? embed.src ?? "";
      return [{ type: "survey_embed", description: url }];
    }

    // ── multimedia/attachment ─────────────────────────────────────────────────
    if (family === "multimedia" && variant === "attachment") {
      const att = d?.media?.attachment;
      if (!att) return [];
      const name = att.originalUrl ?? "attachment";
      return [{ type: "file_attachment", name, description: "" }];
    }

    warnings.push(`Unhandled Rise block: family=${family} variant=${variant}`);
    return [];
  }

  // 8. Build sections
  function deriveSectionName(blocks: RiseBlock[], index: number): string {
    for (const b of blocks) {
      if (b.family === "text" && b.variant === "heading paragraph") {
        const heading = b.items[0]?.heading;
        if (heading && !isEmptyHeading(heading)) {
          return stripHtml(heading);
        }
      }
    }
    return index === 0 ? "Introduction" : `Section ${index + 1}`;
  }

  const sections = await Promise.all(
    sectionGroups.map(async (group, i) => {
      const sectionName = deriveSectionName(group, i);
      const blockArrays = await Promise.all(group.map(mapBlock));
      const blocks = blockArrays.flat();
      // Ensure at least one block
      if (blocks.length === 0) {
        blocks.push({ type: "text", html: "<p>(empty section)</p>" });
      }
      return {
        name: sectionName,
        lessons: [{ name: sectionName, blocks }],
      };
    })
  );

  // Filter out empty sections (groups with no meaningful content)
  const filteredSections = sections.filter(
    (s) =>
      s.lessons[0].blocks.length > 0 &&
      !(s.lessons[0].blocks.length === 1 &&
        s.lessons[0].blocks[0].type === "text" &&
        (s.lessons[0].blocks[0] as { type: string; html: string }).html === "<p>(empty section)</p>")
  );

  // 9. Build CourseStructure
  const courseName = riseCourse.title;
  const rawCourse = {
    name: courseName,
    slug: slugify(courseName),
    sections: filteredSections.length > 0 ? filteredSections : sections,
  };

  const parsed = CourseStructureSchema.safeParse(rawCourse);
  if (!parsed.success) {
    throw new Error(
      `Rise parse produced invalid CourseStructure: ${JSON.stringify(parsed.error.flatten())}`
    );
  }

  return { course: parsed.data, images, warnings };
}
