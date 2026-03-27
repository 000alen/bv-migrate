# bv-migrate — Context Document

## What This Is
A Next.js web app that migrates beVisioneers course content from Google Doc PDFs ("Module Scripts") into Circle LMS. Three-stage pipeline:

1. **PDF Import**: Upload a Module Script PDF → LLM extracts structured content blocks (text, flashcards, accordions, quizzes, labeled images, sorting activities, timelines, padlets, checklists, button stacks)
2. **Image Injection**: Upload a ZIP of images → match to placeholders from stage 1 → upload to Circle CDN via direct_uploads API
3. **Genially Interactives**: User provides Genially embed URLs → tool inserts them at the correct placeholder positions

## Architecture
- **Next.js 15** (App Router)
- **Vercel AI SDK** with Claude 4.6 Opus for PDF extraction
- **shadcn/ui** components
- **Serverless** — no database, no persistent file storage. Everything in-memory/session.
- Deploy to **Vercel**

## User Flow
1. User enters Circle API token + Anthropic API key (client-side, stored in browser only)
2. Upload Module Script PDF
3. App sends PDF to Claude via AI SDK with structured output schema
4. Shows preview of extracted content (sections → lessons → typed content blocks)
5. User reviews, can edit/correct extraction
6. User uploads ZIP folder with images
7. App matches images to placeholders (by filename convention or manual assignment)
8. User provides Genially embed URLs for interactive placeholders
9. User clicks "Import to Circle" → app creates course space, sections, lessons via Circle API
10. Shows import log with all created IDs + interactive element tracker

## Circle API Reference
- **Base**: `https://app.circle.so/api/admin/v2/`
- **Auth**: `Authorization: Token <token>` (NOT Bearer). Must include `User-Agent` header.
- **Key endpoints**:
  - `POST /spaces` — create course space
  - `POST /course_sections` — create section in course
  - `POST /course_lessons` — create lesson in section
  - `POST /direct_uploads` — get presigned URL for file upload
- **CRITICAL**: Circle lesson API strips ALL `<img>` tags from `body_html`. Images can only be embedded via TipTap document model using `signed_id` (eyJ… MessageVerifier format).
- **Image insertion**: Upload file via `direct_uploads` → get `signed_id` → insert into lesson body using TipTap-compatible JSON structure, NOT raw `<img>` HTML.
- **Rate limit**: 30K calls/month

## Content Block Types (from beVisioneers curriculum)
These are the pedagogical patterns used across all modules:

```typescript
type ContentBlock =
  | { type: "text"; html: string }
  | { type: "heading"; level: 2 | 3 | 4; text: string }
  | { type: "flashcard"; cards: Array<{ front: string; back: string }> }
  | { type: "accordion"; tabs: Array<{ title: string; content: string }> }
  | { type: "quiz"; question: string; options: string[]; correctIndex: number; feedbackCorrect: string; feedbackIncorrect: string }
  | { type: "labeled_image"; description: string; labels: Array<{ title: string; content: string }> }
  | { type: "sorting_activity"; description: string; categories: Array<{ name: string; items: string[] }> }
  | { type: "timeline"; description: string; steps: Array<{ title: string; content: string }> }
  | { type: "padlet"; description: string }
  | { type: "checklist"; items: string[] }
  | { type: "button_stack"; buttons: Array<{ label: string; url: string; description: string }> }
  | { type: "image_placeholder"; index: number; description: string }
  | { type: "genially_placeholder"; name: string; description: string }
  | { type: "quote"; content: string }
  | { type: "file_attachment"; name: string; description: string }
  | { type: "survey_embed"; description: string }
  | { type: "divider" }
```

## Course Structure
```typescript
interface CourseStructure {
  name: string;
  slug: string;
  sections: Array<{
    name: string;
    lessons: Array<{
      name: string;
      blocks: ContentBlock[];
    }>;
  }>;
}
```

## LLM Extraction Strategy
- Send PDF to Claude with the content block schema as structured output
- Few-shot: include examples from Module 1 (we have ground truth)
- The PDF contains instructional design annotations like [Labeled image], [Sorting activity], [Flashcards], [Accordion], [Multiple choice], [Checklist], [Buttons stack], [image (N)]
- These map directly to content block types
- Claude should preserve ALL text content faithfully — no summarization, no rewording
- Validation: every lesson must have at least one block, all quizzes must have correctIndex within bounds, all URLs must be valid

## Circle API: Creating a Course
```
1. POST /spaces { name, slug, space_type: "course", space_group_id, course_setting: { course_type: "self_paced" } }
2. POST /course_sections { name, space_id }
3. POST /course_lessons { name, section_id, body_html, status: "draft" }
```

## Circle API: Image Upload
```
1. POST /direct_uploads { filename, byte_size, content_type, checksum (base64 MD5) }
   → returns { signed_id, direct_upload: { url, headers } }
2. PUT <direct_upload.url> with file bytes + headers
3. Use signed_id in lesson body (TipTap image node format)
```

## Key Technical Notes
- Circle uses TipTap/ProseMirror editor internally
- For images to render in lessons, they need to be inserted as TipTap image nodes with `signed_id`, not as `<img>` HTML tags
- The `signed_id` format is eyJ… (Rails MessageVerifier), NOT the `attachable_sgid` (BAh… SignedGlobalID)
- Course settings: self_paced, enforce_lessons_order: false, custom labels: "lesson"/"unit"
- All content created as draft by default

## Brand Guidelines (beVisioneers)
- Colors: Black (#000000), White (#FFF), Light gray (#F5F6F1), Purple (#CE99F2), Yellow (#F9FB75), Orange (#f99756), Cyan (#95E1ED)
- Fonts: ArticulatCF (main), CorpoStext (logo)
- Vibe: global, welcoming, fresh, positive, inclusive

## Genially Integration
- Genially embeds are iframes: `<iframe src="https://view.genially.com/..." ...>`
- Circle lessons support iframe embeds in body_html for posts but may strip them in lessons
- Alternative: insert as a styled link/button that opens Genially in new tab
- The tool should let users paste Genially URLs for each interactive placeholder

## File Structure Suggestion
```
bv-migrate/
├── app/
│   ├── layout.tsx
│   ├── page.tsx              # main wizard UI
│   ├── api/
│   │   ├── extract/route.ts  # PDF → structured JSON via Claude
│   │   ├── preview/route.ts  # JSON → preview HTML
│   │   └── import/route.ts   # JSON → Circle API calls
├── components/
│   ├── pdf-upload.tsx
│   ├── image-upload.tsx
│   ├── content-preview.tsx
│   ├── image-matcher.tsx
│   ├── genially-linker.tsx
│   ├── import-progress.tsx
│   └── api-key-form.tsx
├── lib/
│   ├── schema.ts             # ContentBlock types + Zod validation
│   ├── circle.ts             # Circle API client
│   ├── extract.ts            # LLM extraction logic
│   ├── html-builder.ts       # ContentBlock[] → Circle-compatible HTML
│   └── image-upload.ts       # ZIP handling + Circle direct uploads
├── CONTEXT.md
└── README.md
```
