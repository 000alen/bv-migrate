import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { NextRequest } from "next/server";
import { CourseStructureSchema } from "@/lib/schema";

export const maxDuration = 300;

const SYSTEM_PROMPT = `You are an expert curriculum analyst. Extract the complete course structure from this beVisioneers Module Script PDF as JSON.

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

export async function POST(req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        const anthropicKey = req.headers.get("x-anthropic-key") ?? "";
        if (!anthropicKey) {
          send({ type: "error", error: "Missing x-anthropic-key header" });
          controller.close();
          return;
        }

        const model = req.headers.get("x-model") ?? "claude-sonnet-4-6";

        const formData = await req.formData();
        const pdfFile = formData.get("pdf") as File | null;

        if (!pdfFile) {
          send({ type: "error", error: "Missing pdf file in form data" });
          controller.close();
          return;
        }

        const arrayBuffer = await pdfFile.arrayBuffer();
        const pdfBuffer = Buffer.from(arrayBuffer);

        send({ type: "progress", message: "Starting extraction..." });

        const keepalive = setInterval(() => {
          send({ type: "ping" });
        }, 15000);

        const anthropic = createAnthropic({ apiKey: anthropicKey });

        let result;
        try {
          result = await generateText({
            model: anthropic(model),
            maxTokens: 65536,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "file",
                    data: pdfBuffer,
                    mimeType: "application/pdf",
                  },
                  {
                    type: "text",
                    text: "Extract the complete course structure from this PDF as JSON. Output ONLY the JSON object, nothing else.",
                  },
                ],
              },
            ],
            system: SYSTEM_PROMPT,
          });
        } finally {
          clearInterval(keepalive);
        }

        send({ type: "progress", message: "Validating extraction..." });

        // Parse JSON from text response
        let jsonText = result.text.trim();
        // Strip markdown fences if present
        if (jsonText.startsWith("```")) {
          jsonText = jsonText.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
        }

        let rawObject: unknown;
        try {
          rawObject = JSON.parse(jsonText);
        } catch (parseErr) {
          console.error("JSON parse failed:", parseErr);
          send({
            type: "error",
            error: `Extraction produced invalid JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
          });
          controller.close();
          return;
        }

        // Validate through Zod schema
        const parsed = CourseStructureSchema.safeParse(rawObject);
        if (!parsed.success) {
          console.error("Schema validation failed:", parsed.error.flatten());
          send({
            type: "error",
            error: "Extraction produced invalid structure",
            details: parsed.error.flatten(),
          });
          controller.close();
          return;
        }

        const course = parsed.data;

        // Semantic validation
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
            error: "Extracted content failed validation",
            details: validationErrors,
          });
          controller.close();
          return;
        }

        send({ type: "complete", course });
      } catch (error) {
        console.error("Extract error:", error);
        const message = error instanceof Error ? error.message : String(error);
        send({ type: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
