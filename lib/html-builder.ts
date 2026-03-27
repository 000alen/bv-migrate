import { ContentBlock } from "@/lib/schema";

/**
 * Escape plain text for safe HTML insertion.
 * Only use on fields that contain plain text, NOT on fields that already contain HTML.
 */
function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function blockToHtml(
  block: ContentBlock,
  geniallyUrls?: Record<string, string>
): string {
  switch (block.type) {
    // html field is already HTML — pass through as-is
    case "text":
      return block.html;

    case "heading":
      return `<h${block.level}>${esc(block.text)}</h${block.level}>`;

    case "flashcard":
      return block.cards
        .map(
          (card) =>
            `<blockquote><p><strong>💡 ${esc(card.front)}</strong></p><p>${esc(card.back)}</p></blockquote>`
        )
        .join("\n");

    case "accordion":
      return block.tabs
        .map((tab) => `<h4>▸ ${esc(tab.title)}</h4>\n<p>${esc(tab.content)}</p>`)
        .join("\n");

    case "quiz": {
      const options = block.options
        .map(
          (opt, i) =>
            `<li>${esc(opt)}${i === block.correctIndex ? " ✓" : ""}</li>`
        )
        .join("\n");
      return [
        `<p><strong>❓ ${esc(block.question)}</strong></p>`,
        `<ol>\n${options}\n</ol>`,
        `<p>✅ <em>${esc(block.feedbackCorrect)}</em></p>`,
        `<p>❌ <em>${esc(block.feedbackIncorrect)}</em></p>`,
      ].join("\n");
    }

    case "labeled_image": {
      const labels = block.labels
        .map(
          (label) =>
            `<p><strong>${esc(label.title)}</strong></p>\n<p>${esc(label.content)}</p>`
        )
        .join("\n");
      return `<p>📷 <strong>[IMAGE: ${esc(block.description)}]</strong></p>\n${labels}`;
    }

    case "sorting_activity": {
      const categories = block.categories
        .map((cat) => {
          const items = cat.items
            .map((item) => `<li>${esc(item)}</li>`)
            .join("\n");
          return `<h4>${esc(cat.name)}</h4>\n<ul>\n${items}\n</ul>`;
        })
        .join("\n");
      return `<p>🎮 <strong>[SORTING ACTIVITY: ${esc(block.description)}]</strong></p>\n${categories}`;
    }

    case "timeline": {
      const steps = block.steps
        .map(
          (step) =>
            `<p><strong>${esc(step.title)}</strong></p>\n<p>${esc(step.content)}</p>`
        )
        .join("\n");
      return `<p>🎮 <strong>[TIMELINE: ${esc(block.description)}]</strong></p>\n${steps}`;
    }

    case "padlet":
      return `<p>📋 <strong>[PADLET: ${esc(block.description)}]</strong> <em>(Replace with Padlet embed)</em></p>`;

    case "checklist": {
      const items = block.items
        .map((item) => `<li>☐ ${esc(item)}</li>`)
        .join("\n");
      return `<ul>\n${items}\n</ul>`;
    }

    case "button_stack":
      return block.buttons
        .map(
          (btn) =>
            `<p>🔗 <a href="${esc(btn.url)}"><strong>${esc(btn.label)}</strong></a><br>${esc(btn.description)}</p>`
        )
        .join("\n");

    case "image_placeholder":
      return `<p>📷 <strong>[IMAGE ${block.index}: ${esc(block.description)}]</strong></p>`;

    case "genially_placeholder": {
      const url = geniallyUrls?.[block.name];
      if (url) {
        return `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;"><iframe src="${esc(url)}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen loading="lazy"></iframe></div>`;
      }
      return `<p>🎮 <strong>[INTERACTIVE: ${esc(block.name)}]</strong> — ${esc(block.description)} <em>(Replace with Genially)</em></p>`;
    }

    case "quote":
      return `<blockquote><p>${esc(block.content)}</p></blockquote>`;

    case "file_attachment":
      return `<p>📎 <strong>${esc(block.name)}</strong>: ${esc(block.description)}</p>`;

    case "survey_embed":
      return `<p>📊 <strong>[SURVEY: ${esc(block.description)}]</strong></p>`;

    case "divider":
      return "<hr>";

    default:
      return "";
  }
}

/**
 * Build HTML for a lesson's content blocks.
 * Optionally injects Genially embed URLs for interactive placeholders.
 */
export function buildHtml(
  blocks: ContentBlock[],
  geniallyUrls?: Record<string, string>
): string {
  return blocks
    .map((b) => blockToHtml(b, geniallyUrls))
    .filter(Boolean)
    .join("\n\n");
}

// Keep backward compat alias
export const buildHtmlWithGenially = buildHtml;
