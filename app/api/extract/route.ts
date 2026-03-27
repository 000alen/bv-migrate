import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { NextRequest } from "next/server";
import { CourseStructureSchema } from "@/lib/schema";

// Vercel Pro maxDuration — extraction can take 60-120s for large PDFs
export const maxDuration = 300;

const FEW_SHOT_EXAMPLE = `
Here is an example extraction from a real beVisioneers Module Script PDF.
Study this carefully — your output must follow the same patterns.

INPUT (excerpt from Module 1 PDF):
---
Arrival
Lesson 1: Welcome to the Module 1
[Subheading] Module Journey
[text] Let's take a look at what you can expect...
[Labeled image (1)] Module roadmap
[Label 1] Arrival - You're here! Start by understanding the learning goals...
[Label 2] Unit 1: Scanning the Ecosystem Learn how to identify active solutions...
[Subheading] Learning goals
[text] By the end of this module, you will be able to:
[Numbered list] 1. Identify and analyze existing solutions... 2. Use ecosystem mapping tools...
[Checklist] Unit 1: Existing solutions exploration task / Unit 2: Community challenge
[Subheading] How does this course work?
[Flashcards]
[Side 1] Navigation [Side 2] Press the "Complete the lesson" button to mark it as finished...
[Side 1] Progress [Side 2] You don't have to complete everything at once...
---

OUTPUT:
{
  "name": "Module 1 - DREAM: Learn, Borrow, Adapt",
  "slug": "module-1-dream-learn-borrow-adapt",
  "sections": [{
    "name": "Arrival",
    "lessons": [{
      "name": "Welcome to Module 1",
      "blocks": [
        { "type": "text", "html": "<p><strong>Welcome, Visioneer!</strong></p><p>Learn how to research smarter and build better by borrowing from what already works.</p>" },
        { "type": "heading", "level": 3, "text": "Module Journey" },
        { "type": "text", "html": "<p>Let's take a look at what you can expect and how the learning unfolds throughout this module.</p>" },
        { "type": "genially_placeholder", "name": "LABELED IMAGE — Module Roadmap", "description": "7 labels: Arrival → Unit 1 → Unit 2 → Eco-Spotlight → Checkpoint → Closing → Badge" },
        { "type": "labeled_image", "description": "Module roadmap", "labels": [
          { "title": "Arrival — You're here!", "content": "Start by understanding the learning goals and completing a short ritual to set yourself up for an effective learning process." },
          { "title": "Unit 1: Scanning the Ecosystem", "content": "Learn how to identify active solutions, avoid duplication, and understand what's working locally and globally." }
        ]},
        { "type": "heading", "level": 3, "text": "Learning goals" },
        { "type": "text", "html": "<p>By the end of this module, you will be able to:</p><ol><li><strong>Identify and analyze existing solutions</strong> in your impact zone to avoid duplication and build on what already works.</li><li><strong>Use ecosystem mapping tools</strong> to understand the landscape of stakeholders, resources, and opportunities.</li></ol>" },
        { "type": "checklist", "items": ["Unit 1: Existing solutions exploration task", "Unit 2: Community challenge", "Planet Positivity corner: Case reflection", "Checkpoint 2: Your Challenge and Solution Mapping"] },
        { "type": "heading", "level": 3, "text": "How does this course work?" },
        { "type": "flashcard", "cards": [
          { "front": "Navigation", "back": "Press the \\"Complete the lesson\\" button to mark it as finished. Navigate through the lessons using the menu bar on the right or the arrows next to the lesson name." },
          { "front": "Progress", "back": "You don't have to complete everything at once. Take a break and come back when you're ready. Your progress will be saved!" }
        ]}
      ]
    }]
  }]
}

KEY PATTERNS TO FOLLOW:
- [Labeled image (N)] → BOTH a genially_placeholder (for the interactive) AND a labeled_image (for the text labels). Always emit both.
- [Flashcards] with [Side 1]/[Side 2] → flashcard block with cards array. front = Side 1, back = Side 2.
- [Subheading] → heading block with level 3
- [Accordion] with tabs → accordion block with tabs array
- [Multiple choice] → quiz block with question, options[], correctIndex, feedbackCorrect, feedbackIncorrect
- [Sorting activity] → sorting_activity block with categories
- [Timeline] → timeline block with steps
- [Padlet] → padlet block (just description, it's an external embed)
- [Checklist] → checklist block with items array
- [Buttons stack] → button_stack block with buttons array (label, url, description)
- [image (N)] → image_placeholder with index N
- [text] → text block with html field — preserve ALL formatting (bold, italic, lists, links, etc) as HTML
- [Quote] → quote block
- [Survey] → survey_embed block
- [Continue Button] / [Let's Start!] → OMIT these. They are navigation UI elements, not content.
- Section names come from the unit headers (e.g., "Arrival", "Unit 1: Scanning the Ecosystem", "Eco-Spotlight", "Checkpoint 2", "Closing")
- Lesson names come from the lesson titles (e.g., "Welcome to Module 1", "Our Ritual", "Why build on the shoulders of others?")
`;

const SYSTEM_PROMPT = `You are an expert curriculum analyst specializing in beVisioneers educational content. Extract the complete course structure from this beVisioneers Module Script PDF.

CRITICAL RULES:
- Preserve ALL text content faithfully — do NOT summarize, paraphrase, or omit anything
- Every paragraph, bullet point, and sentence from the PDF must appear in your output
- Map instructional annotations to typed blocks exactly as shown in the example
- Extract course name from the module title (format: "Module N - PHASE: Title")
- Generate a URL-safe slug from the course name
- Every section must have at least 1 lesson
- Every lesson must have at least 1 block
- Quiz correctIndex must be a valid index into the options array
- image_placeholder index should match the number in [image (N)] annotation

${FEW_SHOT_EXAMPLE}`;

export async function POST(req: NextRequest) {
  // Use SSE to keep the connection alive during long extractions (Vercel timeout mitigation)
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

        // Send keepalive pings every 15s to prevent connection timeout
        const keepalive = setInterval(() => {
          send({ type: "ping" });
        }, 15000);

        const anthropic = createAnthropic({ apiKey: anthropicKey });

        let result;
        try {
          result = await generateObject({
            model: anthropic(model),
            schema: CourseStructureSchema,
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
                    text: "Extract the complete course structure from this PDF. Follow the example patterns exactly.",
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

        // Explicit re-validation through Zod schema
        const parsed = CourseStructureSchema.safeParse(result.object);
        if (!parsed.success) {
          console.error("Extraction schema validation failed:", parsed.error.flatten());
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
                  `Quiz in "${lesson.name}": correctIndex ${block.correctIndex} is out of bounds (${block.options.length} options)`
                );
              }
            }
          }
        }

        if (validationErrors.length > 0) {
          console.error("Extraction semantic validation failed:", validationErrors);
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
