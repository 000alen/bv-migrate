---
id: extraction
title: PDF Extraction
sidebar_position: 2
---

# PDF Extraction

The extraction step takes a PDF and produces a structured `CourseStructure` JSON object. It uses Claude via the Vercel AI SDK's `generateObject` with a Zod schema.

## What happens

1. The browser sends the PDF as `multipart/form-data` to `POST /api/extract`
2. The route opens an SSE stream back to the browser
3. The PDF bytes are passed to `generateObject` with `claude-opus-4-5` (or the model you have access to)
4. Claude reads the full document and outputs structured JSON matching the `CourseStructure` schema
5. The route validates the output with Zod, runs semantic checks, then sends the result over SSE
6. A keepalive ping fires every 15 seconds while waiting — this prevents proxies from closing the connection on long PDFs

## The prompt

The system prompt tells Claude to extract all content faithfully, preserve the original structure (sections and lessons as they appear in the document), and classify each piece of content into the correct block type. It's instructed not to invent content, summarize, or reorder.

## Validation

After extraction, the route runs two rounds of validation:

**Zod validation** — Confirms the output matches the schema. Every field, every block type.

**Semantic checks** — Additional rules that Zod can't express:
- Every lesson has at least one content block
- No duplicate section titles
- No empty text strings in text blocks
- Required fields on specific block types (e.g., `quiz` blocks need `question` and `options`)

If either validation fails, the route sends an `error` event over SSE with the details.

## What the extracted JSON looks like

```json
{
  "title": "Introduction to Product Management",
  "sections": [
    {
      "title": "What is Product Management?",
      "lessons": [
        {
          "title": "The PM Role",
          "blocks": [
            { "type": "heading", "level": 2, "text": "The PM Role" },
            { "type": "text", "html": "<p>A product manager...</p>" },
            {
              "type": "quiz",
              "question": "What is the primary responsibility of a PM?",
              "options": ["Ship features", "Own the product vision", "Write code", "Manage engineers"],
              "correct": 1,
              "explanation": "PMs own the product vision and strategy."
            }
          ]
        }
      ]
    }
  ]
}
```

## Block types Claude produces

Claude can produce any of the 18 block types defined in `lib/schema.ts`. In practice, what it actually emits depends on what's in the PDF. A PDF with no quizzes produces no `quiz` blocks. Claude doesn't invent structure that isn't there.

The most common types from real PDFs: `text`, `heading`, `image_placeholder`, `quiz`, `flashcard`, `accordion`.

## Performance

Extraction time scales with PDF size and content density. A 20-page course PDF typically takes 30-90 seconds. The SSE keepalive prevents timeout errors on the client side during long extractions.

The model reads the entire PDF as a single document — there's no chunking or multi-pass extraction.
