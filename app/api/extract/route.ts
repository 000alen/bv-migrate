import { generateText } from "ai";
import { NextRequest } from "next/server";
import { CourseStructureSchema } from "@/lib/schema";
import { createSSEStream, sseResponse } from "@/lib/sse";
import { extractBalancedJsonObject } from "@/lib/extract-json";
import { formatZodError, normalizeCourseStructure } from "@/lib/course-normalize";
import { extractScriptTextFromPdf } from "@/lib/pdf-text";
import { resolveExtractLlm } from "@/lib/extract-llm";

export const maxDuration = 300;

/** Anthropic max output for Claude Sonnet 4.6 (see models overview). */
const MAX_OUTPUT_TOKENS = 64_000;

const SYSTEM_PROMPT = `You are an expert curriculum analyst. You receive the full text of a beVisioneers Module Script (extracted from a PDF). The line breaks may not match the original layout — infer structure from headings, lesson names, and markers like [Flashcards], [image (N)], etc.

Output a single JSON object with this exact structure:
{
  "name": "Module N - PHASE: Title",
  "slug": "module-n-phase-title",
  "sections": [
    {
      "name": "Section Name",
      "lessons": [
        {
          "name": "Lesson Name",
          "blocks": [
            { "type": "text", "html": "<p>content here</p>" },
            { "type": "heading", "level": 3, "text": "heading text" },
            { "type": "flashcard", "cards": [{ "front": "...", "back": "..." }] },
            { "type": "accordion", "tabs": [{ "title": "...", "content": "..." }] },
            { "type": "quiz", "question": "...", "options": ["A","B","C"], "correctIndex": 2, "feedbackCorrect": "...", "feedbackIncorrect": "..." },
            { "type": "labeled_image", "description": "...", "labels": [{ "title": "...", "content": "..." }] },
            { "type": "sorting_activity", "description": "...", "categories": [{ "name": "...", "items": ["..."] }] },
            { "type": "timeline", "description": "...", "steps": [{ "title": "...", "content": "..." }] },
            { "type": "padlet", "description": "..." },
            { "type": "checklist", "items": ["item 1", "item 2"] },
            { "type": "button_stack", "buttons": [{ "label": "...", "url": "https://...", "description": "..." }] },
            { "type": "image_placeholder", "index": 1, "description": "..." },
            { "type": "genially_placeholder", "name": "...", "description": "..." },
            { "type": "quote", "content": "..." },
            { "type": "file_attachment", "name": "...", "description": "..." },
            { "type": "survey_embed", "description": "..." },
            { "type": "divider" }
          ]
        }
      ]
    }
  ]
}

EXAMPLE — from a real beVisioneers Module 1 script:
Section "Arrival", Lesson "Welcome to Module 1":
[Labeled image (1)] Module roadmap → BOTH genially_placeholder AND labeled_image blocks
[Flashcards] [Side 1] Navigation [Side 2] Press the "Complete..." → flashcard with cards array
[Subheading] Learning goals → heading level 3
[Checklist] Unit 1: task / Unit 2: task → checklist with items array
[image (1)] → image_placeholder index 1
[Continue Button] → OMIT (navigation UI, not content)

RULES:
- Preserve ALL text faithfully — no summarization, no omission
- [Labeled image (N)] → BOTH genially_placeholder AND labeled_image blocks
- [Flashcards] with [Side 1]/[Side 2] → flashcard block
- [Subheading] → heading level 3
- [Accordion] → accordion block with tabs
- [Multiple choice] → quiz block
- [Sorting activity] → sorting_activity block
- [Timeline] → timeline block
- [Padlet] → padlet block
- [Checklist] → checklist block
- [Buttons stack] → button_stack block
- [image (N)] → image_placeholder with index N
- [Quote] → quote block
- [Survey] → survey_embed block
- [Continue Button] / [Let's Start!] → OMIT
- Output ONLY valid JSON. No markdown fences. No explanation. Just the JSON object.`;

/** Legacy prompt when sending the PDF file directly to Claude (slower). */
const SYSTEM_PROMPT_NATIVE_PDF = `You are an expert curriculum analyst. Extract the complete course structure from this beVisioneers Module Script PDF as JSON.

Output a single JSON object with this exact structure:
{
  "name": "Module N - PHASE: Title",
  "slug": "module-n-phase-title",
  "sections": [
    {
      "name": "Section Name",
      "lessons": [
        {
          "name": "Lesson Name",
          "blocks": [
            { "type": "text", "html": "<p>content here</p>" },
            { "type": "heading", "level": 3, "text": "heading text" },
            { "type": "flashcard", "cards": [{ "front": "...", "back": "..." }] },
            { "type": "accordion", "tabs": [{ "title": "...", "content": "..." }] },
            { "type": "quiz", "question": "...", "options": ["A","B","C"], "correctIndex": 2, "feedbackCorrect": "...", "feedbackIncorrect": "..." },
            { "type": "labeled_image", "description": "...", "labels": [{ "title": "...", "content": "..." }] },
            { "type": "sorting_activity", "description": "...", "categories": [{ "name": "...", "items": ["..."] }] },
            { "type": "timeline", "description": "...", "steps": [{ "title": "...", "content": "..." }] },
            { "type": "padlet", "description": "..." },
            { "type": "checklist", "items": ["item 1", "item 2"] },
            { "type": "button_stack", "buttons": [{ "label": "...", "url": "https://...", "description": "..." }] },
            { "type": "image_placeholder", "index": 1, "description": "..." },
            { "type": "genially_placeholder", "name": "...", "description": "..." },
            { "type": "quote", "content": "..." },
            { "type": "file_attachment", "name": "...", "description": "..." },
            { "type": "survey_embed", "description": "..." },
            { "type": "divider" }
          ]
        }
      ]
    }
  ]
}

EXAMPLE — from a real beVisioneers Module 1 PDF:
Section "Arrival", Lesson "Welcome to Module 1":
[Labeled image (1)] Module roadmap → BOTH genially_placeholder AND labeled_image blocks
[Flashcards] [Side 1] Navigation [Side 2] Press the "Complete..." → flashcard with cards array
[Subheading] Learning goals → heading level 3
[Checklist] Unit 1: task / Unit 2: task → checklist with items array
[image (1)] → image_placeholder index 1
[Continue Button] → OMIT (navigation UI, not content)

RULES:
- Preserve ALL text faithfully — no summarization, no omission
- [Labeled image (N)] → BOTH genially_placeholder AND labeled_image blocks
- [Flashcards] with [Side 1]/[Side 2] → flashcard block
- [Subheading] → heading level 3
- [Accordion] → accordion block with tabs
- [Multiple choice] → quiz block
- [Sorting activity] → sorting_activity block
- [Timeline] → timeline block
- [Padlet] → padlet block
- [Checklist] → checklist block
- [Buttons stack] → button_stack block
- [image (N)] → image_placeholder with index N
- [Quote] → quote block
- [Survey] → survey_embed block
- [Continue Button] / [Let's Start!] → OMIT
- Output ONLY valid JSON. No markdown fences. No explanation. Just the JSON object.`;

function stripMarkdownFences(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```json?\n?/i, "").replace(/\n?```$/i, "");
  }
  return t.trim();
}

function tryParseJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const stripped = stripMarkdownFences(text);
  try {
    return { ok: true, value: JSON.parse(stripped) };
  } catch (e1) {
    const extracted = extractBalancedJsonObject(stripped);
    if (extracted) {
      try {
        return { ok: true, value: JSON.parse(extracted) };
      } catch (e2) {
        return {
          ok: false,
          error: e2 instanceof Error ? e2.message : String(e2),
        };
      }
    }
    return {
      ok: false,
      error: e1 instanceof Error ? e1.message : String(e1),
    };
  }
}

export async function POST(req: NextRequest) {
  const { stream, send, close } = createSSEStream();

  void (async () => {
    const t0 = Date.now();
    const log = (msg: string, extra?: Record<string, unknown>) => {
      console.log(`[extract] ${msg}`, { ms: Date.now() - t0, ...extra });
    };

    try {
      /** `native-pdf` = send PDF bytes to Anthropic only (slow). Default = local text extract + LLM. */
      const extractMode = req.headers.get("x-extract-mode") ?? "";
      const useNativePdf =
        extractMode === "native-pdf" || process.env.BV_EXTRACT_MODE === "native-pdf";

      const formData = await req.formData();
      const pdfFile = formData.get("pdf") as File | null;

      if (!pdfFile) {
        send({ type: "error", message: "Missing pdf file in form data" });
        return;
      }

      const llm = resolveExtractLlm(req);
      if (!llm.ok) {
        send({ type: "error", message: llm.message });
        return;
      }

      if (useNativePdf && llm.provider !== "anthropic") {
        send({
          type: "error",
          message:
            "Native PDF mode only works with Anthropic. Use default text extraction for Cerebras, or set x-llm-provider to anthropic.",
        });
        return;
      }

      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuffer);

      log("pdf_received", {
        bytes: pdfBuffer.length,
        provider: llm.provider,
        modelId: llm.modelId,
        useNativePdf,
      });

      const keepalive = setInterval(() => {
        send({ type: "ping" });
      }, 15_000);

      let result: Awaited<ReturnType<typeof generateText>>;

      try {
        if (useNativePdf) {
          send({ type: "progress", message: "Sending PDF to Claude (native PDF mode)…" });
          const genStart = Date.now();
          result = await generateText({
            model: llm.model,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "file",
                    data: pdfBuffer,
                    mediaType: "application/pdf",
                  },
                  {
                    type: "text",
                    text: "Extract the complete course structure from this PDF as JSON. Output ONLY the JSON object, nothing else.",
                  },
                ],
              },
            ],
            system: SYSTEM_PROMPT_NATIVE_PDF,
          });
          log("model_complete_native_pdf", {
            modelMs: Date.now() - genStart,
            finishReason: result.finishReason,
            usage: result.usage,
          });
        } else {
          send({ type: "progress", message: "Extracting text from PDF…" });
          const parseStart = Date.now();
          const { text: scriptText, numPages, truncated } =
            await extractScriptTextFromPdf(pdfBuffer);
          log("pdf_text_extracted", {
            numPages,
            chars: scriptText.length,
            truncated,
            parseMs: Date.now() - parseStart,
          });

          if (!scriptText.trim()) {
            send({
              type: "error",
              message:
                "No extractable text in this PDF (it may be scanned images only). Retry with header x-extract-mode: native-pdf or use an OCR’d PDF.",
            });
            return;
          }

          if (truncated) {
            send({
              type: "progress",
              message: `Script text truncated to ${scriptText.length.toLocaleString()} chars (BV_EXTRACT_MAX_TEXT_CHARS). Continuing…`,
            });
          }

          const llmLabel = llm.provider === "cerebras" ? "Cerebras" : "Claude";
          send({
            type: "progress",
            message: `Structuring course with ${llmLabel} (${scriptText.length.toLocaleString()} chars of script text)…`,
          });

          const userPrompt = `Below is the full text extracted from the Module Script PDF. Build the complete course structure as one JSON object per your system instructions.

---BEGIN EXTRACTED SCRIPT---
${scriptText}
---END EXTRACTED SCRIPT---`;

          const genStart = Date.now();
          result = await generateText({
            model: llm.model,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            messages: [
              {
                role: "user",
                content: [{ type: "text", text: userPrompt }],
              },
            ],
            system: SYSTEM_PROMPT,
          });
          log("model_complete_text_mode", {
            modelMs: Date.now() - genStart,
            finishReason: result.finishReason,
            usage: result.usage,
          });
        }
      } finally {
        clearInterval(keepalive);
      }

      if (result.finishReason === "length") {
        log("finish_reason_length", { usage: result.usage });
      }

      send({ type: "progress", message: "Parsing and validating extraction…" });

      let parsedJson = tryParseJson(result.text);
      if (!parsedJson.ok) {
        const firstParseError = parsedJson.error;
        log("json_parse_failed_attempting_repair", { firstError: firstParseError });
        send({
          type: "progress",
          message: "Repairing malformed JSON (second pass)…",
        });

        const repairStart = Date.now();
        const snippet = result.text.slice(0, 350_000);
        const repair = await generateText({
          model: llm.model,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          system:
            "You fix malformed or truncated JSON. Output a single valid JSON object only. No markdown fences. No commentary.",
          messages: [
            {
              role: "user",
              content: `The following text was meant to be one JSON object for a course curriculum (sections, lessons, blocks). It may be truncated or have syntax errors. Return ONE complete valid JSON object with the same data preserved as much as possible.\n\n---\n${snippet}\n---`,
            },
          ],
        });
        log("repair_complete", { repairMs: Date.now() - repairStart, finishReason: repair.finishReason });

        parsedJson = tryParseJson(repair.text);
        if (!parsedJson.ok) {
          console.error("JSON parse failed after repair:", parsedJson.error);
          send({
            type: "error",
            message:
              result.finishReason === "length"
                ? `Output was truncated (${result.finishReason}) and JSON could not be repaired. Try a smaller PDF or run again.`
                : `Extraction produced invalid JSON (repair pass failed): ${parsedJson.error}`,
            details: {
              firstPassError: firstParseError,
              repairPassError: parsedJson.error,
              repairFinishReason: repair.finishReason,
              originalFinishReason: result.finishReason,
            },
          });
          return;
        }
      }

      const normalized = normalizeCourseStructure(parsedJson.value);
      const schemaParsed = CourseStructureSchema.safeParse(normalized);
      if (!schemaParsed.success) {
        console.error("Schema validation failed:", schemaParsed.error.flatten());
        send({
          type: "error",
          message: "Extraction produced invalid structure after normalization",
          details: formatZodError(schemaParsed.error),
        });
        return;
      }

      const course = schemaParsed.data;

      const validationErrors: string[] = [];
      for (const section of course.sections) {
        if (section.lessons.length === 0) {
          validationErrors.push(`Section "${section.name}" has no lessons`);
        }
        for (const lesson of section.lessons) {
          if (lesson.blocks.length === 0) {
            validationErrors.push(`Lesson "${lesson.name}" has no content blocks`);
          }
          for (const block of lesson.blocks) {
            if (block.type === "quiz" && block.correctIndex >= block.options.length) {
              validationErrors.push(
                `Quiz in "${lesson.name}": correctIndex ${block.correctIndex} out of bounds (${block.options.length} options)`
              );
            }
          }
        }
      }

      if (validationErrors.length > 0) {
        console.error("Semantic validation failed:", validationErrors);
        send({
          type: "error",
          message: "Extracted content failed validation",
          details: validationErrors,
        });
        return;
      }

      log("extract_ok", { totalMs: Date.now() - t0 });
      send({ type: "complete", course });
    } catch (error) {
      console.error("Extract error:", error);
      send({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      close();
    }
  })();

  return sseResponse(stream);
}
