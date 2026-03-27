import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { NextRequest } from "next/server";
import { CourseStructureSchema } from "@/lib/schema";

const SYSTEM_PROMPT = `You are an expert curriculum analyst. Extract the complete course structure from this beVisioneers Module Script PDF.

CRITICAL RULES:
- Preserve ALL text content faithfully — do NOT summarize, paraphrase, or omit anything
- Map instructional annotations to typed blocks:
  [Labeled image] → labeled_image block
  [Flashcards] / [Flashcard] → flashcard block
  [Accordion] → accordion block
  [Multiple choice] / [Quiz] → quiz block
  [Sorting activity] → sorting_activity block
  [Timeline] → timeline block
  [Padlet] → padlet block
  [Checklist] → checklist block
  [Buttons stack] / [Button stack] → button_stack block
  [image (N)] or [image N] → image_placeholder block with index N
  [Genially] / interactive Genially elements → genially_placeholder block
  [Quote] → quote block
  [Survey] → survey_embed block
- Extract course name, sections, and lessons exactly as structured in the PDF
- Every lesson must have at least 1 block
- Quiz correctIndex must be within bounds of options array
- image_placeholder index should match the number in [image (N)] annotation`;

export async function POST(req: NextRequest) {
  try {
    const anthropicKey = req.headers.get("x-anthropic-key") ?? "";
    if (!anthropicKey) {
      return Response.json(
        { error: "Missing x-anthropic-key header" },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const pdfFile = formData.get("pdf") as File | null;

    if (!pdfFile) {
      return Response.json({ error: "Missing pdf file in form data" }, { status: 400 });
    }

    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    const anthropic = createAnthropic({ apiKey: anthropicKey });

    const result = await generateObject({
      model: anthropic("claude-opus-4-6"),
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
              text: "Extract the complete course structure from this PDF.",
            },
          ],
        },
      ],
      system: SYSTEM_PROMPT,
    });

    return Response.json(result.object);
  } catch (error) {
    console.error("Extract error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
