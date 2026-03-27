import { ContentBlock } from "@/lib/schema";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function blockToHtml(block: ContentBlock): string {
  switch (block.type) {
    case "text":
      return block.html;

    case "heading":
      return `<h${block.level}>${escapeHtml(block.text)}</h${block.level}>`;

    case "flashcard":
      return block.cards
        .map(
          (card) =>
            `<blockquote><p><strong>Q:</strong> ${escapeHtml(card.front)}</p><p><strong>A:</strong> ${escapeHtml(card.back)}</p></blockquote>`
        )
        .join("\n");

    case "accordion":
      return block.tabs
        .map(
          (tab) =>
            `<h4>${escapeHtml(tab.title)}</h4>\n<p>${escapeHtml(tab.content)}</p>`
        )
        .join("\n");

    case "quiz": {
      const optionsList = block.options
        .map((opt) => `<li>${escapeHtml(opt)}</li>`)
        .join("\n");
      const correctOption = block.options[block.correctIndex] ?? "";
      return `<p><strong>Q: ${escapeHtml(block.question)}</strong></p>\n<ol>\n${optionsList}\n</ol>\n<p><em>&#10003; Correct: ${escapeHtml(correctOption)}</em></p>\n<p><em>Feedback (correct): ${escapeHtml(block.feedbackCorrect)}</em></p>\n<p><em>Feedback (incorrect): ${escapeHtml(block.feedbackIncorrect)}</em></p>`;
    }

    case "labeled_image": {
      const labels = block.labels
        .map(
          (label) =>
            `<h4>${escapeHtml(label.title)}</h4>\n<p>${escapeHtml(label.content)}</p>`
        )
        .join("\n");
      return `<p><em>[IMAGE: ${escapeHtml(block.description)}]</em></p>\n${labels}`;
    }

    case "sorting_activity": {
      const categories = block.categories
        .map((cat) => {
          const items = cat.items
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join("\n");
          return `<h4>${escapeHtml(cat.name)}</h4>\n<ul>\n${items}\n</ul>`;
        })
        .join("\n");
      return `<p>${escapeHtml(block.description)}</p>\n${categories}`;
    }

    case "timeline": {
      const steps = block.steps
        .map(
          (step) =>
            `<h4>${escapeHtml(step.title)}</h4>\n<p>${escapeHtml(step.content)}</p>`
        )
        .join("\n");
      return `<p>${escapeHtml(block.description)}</p>\n${steps}`;
    }

    case "padlet":
      return `<p><em>📋 Padlet: ${escapeHtml(block.description)}</em></p>`;

    case "checklist": {
      const items = block.items
        .map((item) => `<li>&#9744; ${escapeHtml(item)}</li>`)
        .join("\n");
      return `<ul>\n${items}\n</ul>`;
    }

    case "button_stack":
      return block.buttons
        .map(
          (btn) =>
            `<p><a href="${escapeHtml(btn.url)}"><strong>${escapeHtml(btn.label)}</strong></a> — ${escapeHtml(btn.description)}</p>`
        )
        .join("\n");

    case "image_placeholder":
      return `<p><strong>📷 [IMAGE: ${escapeHtml(block.description)}]</strong></p>`;

    case "genially_placeholder":
      return `<p><em>🎮 Interactive: ${escapeHtml(block.name)} — ${escapeHtml(block.description)}</em></p>`;

    case "quote":
      return `<blockquote><p>${escapeHtml(block.content)}</p></blockquote>`;

    case "file_attachment":
      return `<p>📎 <strong>${escapeHtml(block.name)}</strong>: ${escapeHtml(block.description)}</p>`;

    case "survey_embed":
      return `<p><em>📊 Survey: ${escapeHtml(block.description)}</em></p>`;

    case "divider":
      return `<hr>`;

    default:
      return "";
  }
}

export function buildHtml(blocks: ContentBlock[]): string {
  return blocks.map(blockToHtml).filter(Boolean).join("\n\n");
}

export function buildHtmlWithGenially(
  blocks: ContentBlock[],
  geniallyUrls: Record<string, string>
): string {
  return blocks
    .map((block) => {
      if (block.type === "genially_placeholder") {
        const url = geniallyUrls[block.name];
        if (url) {
          return `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;"><iframe src="${escapeHtml(url)}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen loading="lazy"></iframe></div>`;
        }
      }
      return blockToHtml(block);
    })
    .filter(Boolean)
    .join("\n\n");
}
