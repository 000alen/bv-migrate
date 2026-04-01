import type { ZodError } from "zod";

const KNOWN_BLOCK_TYPES = new Set([
  "text",
  "heading",
  "flashcard",
  "accordion",
  "quiz",
  "labeled_image",
  "sorting_activity",
  "timeline",
  "padlet",
  "checklist",
  "button_stack",
  "image_placeholder",
  "genially_placeholder",
  "quote",
  "file_attachment",
  "survey_embed",
  "divider",
]);

function clampHeadingLevel(n: number): 2 | 3 | 4 {
  if (n <= 2) return 2;
  if (n === 3) return 3;
  return 4;
}

function asString(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return fallback;
  return String(v);
}

function asNumber(v: unknown, fallback = 0): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

/** Coerce a loose model block into something the Zod schema can accept. */
export function normalizeBlock(block: unknown): Record<string, unknown> {
  if (!block || typeof block !== "object" || Array.isArray(block)) {
    return {
      type: "text",
      html: "<p>(Unrecognized block in extraction — please edit in preview.)</p>",
    };
  }

  const b = block as Record<string, unknown>;
  const rawType = typeof b.type === "string" ? b.type.toLowerCase().trim() : "";
  const type = rawType.replace(/\s+/g, "_");

  if (!KNOWN_BLOCK_TYPES.has(type)) {
    return {
      type: "text",
      html: `<p><em>Unknown block type "${asString(b.type)}".</em></p><pre>${escapeHtml(JSON.stringify(block, null, 2))}</pre>`,
    };
  }

  switch (type) {
    case "text":
      return {
        type: "text",
        html: asString(b.html, "<p></p>"),
      };
    case "heading": {
      const lvl = Math.round(asNumber(b.level, 3));
      return {
        type: "heading",
        level: clampHeadingLevel(lvl),
        text: asString(b.text),
      };
    }
    case "flashcard": {
      const cards = Array.isArray(b.cards) ? b.cards : [];
      const normalized = cards.map((c) => {
        if (!c || typeof c !== "object") return { front: "", back: "" };
        const x = c as Record<string, unknown>;
        return { front: asString(x.front), back: asString(x.back) };
      });
      return {
        type: "flashcard",
        cards: normalized.length > 0 ? normalized : [{ front: "", back: "" }],
      };
    }
    case "accordion": {
      const tabs = Array.isArray(b.tabs) ? b.tabs : [];
      const normalized = tabs.map((t) => {
        if (!t || typeof t !== "object") return { title: "", content: "" };
        const x = t as Record<string, unknown>;
        return { title: asString(x.title), content: asString(x.content) };
      });
      return {
        type: "accordion",
        tabs: normalized.length > 0 ? normalized : [{ title: "", content: "" }],
      };
    }
    case "quiz": {
      const optionsRaw = Array.isArray(b.options) ? b.options : [];
      const options = optionsRaw.map((o) => asString(o)).filter((s) => s.length > 0);
      const safeOptions = options.length >= 2 ? options : ["Option A", "Option B"];
      let correctIndex = Math.floor(asNumber(b.correctIndex, 0));
      correctIndex = Math.max(0, Math.min(correctIndex, safeOptions.length - 1));
      return {
        type: "quiz",
        question: asString(b.question),
        options: safeOptions,
        correctIndex,
        feedbackCorrect: asString(b.feedbackCorrect),
        feedbackIncorrect: asString(b.feedbackIncorrect),
      };
    }
    case "labeled_image": {
      const labelsRaw = Array.isArray(b.labels) ? b.labels : [];
      const labels = labelsRaw.map((l) => {
        if (!l || typeof l !== "object") return { title: "", content: "" };
        const x = l as Record<string, unknown>;
        return { title: asString(x.title), content: asString(x.content) };
      });
      return {
        type: "labeled_image",
        description: asString(b.description),
        labels: labels.length > 0 ? labels : [{ title: "", content: "" }],
      };
    }
    case "sorting_activity": {
      const catsRaw = Array.isArray(b.categories) ? b.categories : [];
      const categories = catsRaw.map((c) => {
        if (!c || typeof c !== "object") return { name: "", items: [""] };
        const x = c as Record<string, unknown>;
        const itemsRaw = Array.isArray(x.items) ? x.items : [];
        const items = itemsRaw.map((i) => asString(i)).filter((s) => s.length > 0);
        return {
          name: asString(x.name),
          items: items.length > 0 ? items : [""],
        };
      });
      return {
        type: "sorting_activity",
        description: asString(b.description),
        categories: categories.length > 0 ? categories : [{ name: "", items: [""] }],
      };
    }
    case "timeline": {
      const stepsRaw = Array.isArray(b.steps) ? b.steps : [];
      const steps = stepsRaw.map((s) => {
        if (!s || typeof s !== "object") return { title: "", content: "" };
        const x = s as Record<string, unknown>;
        return { title: asString(x.title), content: asString(x.content) };
      });
      return {
        type: "timeline",
        description: asString(b.description),
        steps: steps.length > 0 ? steps : [{ title: "", content: "" }],
      };
    }
    case "padlet":
      return { type: "padlet", description: asString(b.description) };
    case "checklist": {
      const itemsRaw = Array.isArray(b.items) ? b.items : [];
      const items = itemsRaw.map((i) => asString(i)).filter((s) => s.length > 0);
      return {
        type: "checklist",
        items: items.length > 0 ? items : ["(empty checklist)"],
      };
    }
    case "button_stack": {
      const buttonsRaw = Array.isArray(b.buttons) ? b.buttons : [];
      const buttons = buttonsRaw.map((btn) => {
        if (!btn || typeof btn !== "object") {
          return { label: "", url: "https://example.com", description: "" };
        }
        const x = btn as Record<string, unknown>;
        return {
          label: asString(x.label),
          url: asString(x.url, "https://example.com"),
          description: asString(x.description),
        };
      });
      return {
        type: "button_stack",
        buttons:
          buttons.length > 0
            ? buttons
            : [{ label: "", url: "https://example.com", description: "" }],
      };
    }
    case "image_placeholder":
      return {
        type: "image_placeholder",
        index: Math.max(0, Math.floor(asNumber(b.index, 0))),
        description: asString(b.description),
      };
    case "genially_placeholder":
      return {
        type: "genially_placeholder",
        name: asString(b.name),
        description: asString(b.description),
      };
    case "quote":
      return { type: "quote", content: asString(b.content) };
    case "file_attachment":
      return {
        type: "file_attachment",
        name: asString(b.name),
        description: asString(b.description),
      };
    case "survey_embed":
      return { type: "survey_embed", description: asString(b.description) };
    case "divider":
      return { type: "divider" };
    default:
      return {
        type: "text",
        html: "<p>(Internal normalization error.)</p>",
      };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PLACEHOLDER_BLOCK = {
  type: "text" as const,
  html: "<p><em>(This lesson had no blocks — add content in the preview if needed.)</em></p>",
};

/**
 * Coerce a parsed JSON object toward our CourseStructure shape before Zod.
 */
export function normalizeCourseStructure(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      name: "Untitled module",
      slug: "untitled-module",
      sections: [],
    };
  }

  const o = raw as Record<string, unknown>;
  const name = asString(o.name, "Untitled module");
  const slug = asString(o.slug, "untitled-module").replace(/\s+/g, "-").toLowerCase();

  const sectionsRaw = Array.isArray(o.sections) ? o.sections : [];
  const sections = sectionsRaw.map((sec) => {
    if (!sec || typeof sec !== "object") {
      return {
        name: "Section",
        lessons: [
          {
            name: "Lesson",
            blocks: [PLACEHOLDER_BLOCK],
          },
        ],
      };
    }
    const s = sec as Record<string, unknown>;
    const sectionName = asString(s.name, "Section");
    const lessonsRaw = Array.isArray(s.lessons) ? s.lessons : [];
    const lessons = lessonsRaw.map((les) => {
      if (!les || typeof les !== "object") {
        return { name: "Lesson", blocks: [PLACEHOLDER_BLOCK] };
      }
      const l = les as Record<string, unknown>;
      const lessonName = asString(l.name, "Lesson");
      const blocksRaw = Array.isArray(l.blocks) ? l.blocks : [];
      const blocks = blocksRaw.map((bl) => normalizeBlock(bl));
      return {
        name: lessonName,
        blocks: blocks.length > 0 ? blocks : [PLACEHOLDER_BLOCK],
      };
    });

    return {
      name: sectionName,
      lessons:
        lessons.length > 0
          ? lessons
          : [{ name: "Lesson", blocks: [PLACEHOLDER_BLOCK] }],
    };
  });

  return {
    name,
    slug,
    sections:
      sections.length > 0
        ? sections
        : [
            {
              name: "Section",
              lessons: [{ name: "Lesson", blocks: [PLACEHOLDER_BLOCK] }],
            },
          ],
  };
}

export function formatZodError(err: ZodError): string {
  try {
    return JSON.stringify(err.flatten(), null, 2);
  } catch {
    return err.message;
  }
}
