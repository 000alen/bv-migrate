# Content Constructors 👷

Migrate beVisioneers course content from Google Doc PDFs ("Module Scripts") into Circle LMS. A conversational wizard guided by Bob the Builder.

## What it does

1. **Extract**: Upload a Module Script PDF → text is read locally, then **Cerebras** (default) or **Anthropic (Claude)** turns it into structured content (sections, lessons, flashcards, quizzes, accordions, etc.). Optional Anthropic **native PDF** mode for scanned documents.
2. **Images**: Upload a ZIP of images → match them to placeholders in the extracted content
3. **Interactives + Import**: Paste Genially embed URLs → Import everything to Circle as draft courses

## Run locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Click ⚙️ to enter your Circle API token, space group ID, and **Cerebras** API key (default), or switch to Anthropic if you prefer Claude.

## Deploy to Vercel

Connect this repo to Vercel. By default, extraction keys are entered in the app and stored in **localStorage** (browser only).

Optional **server** environment variables for `/api/extract` (e.g. CI or server-only keys):

| Variable | Purpose |
|----------|---------|
| `CEREBRAS_API_KEY` | Cerebras when no `x-cerebras-key` header |
| `BV_CEREBRAS_MODEL` | Override model (default `gpt-oss-120b`) |
| `BV_EXTRACTION_LLM` | `cerebras` or `anthropic` when headers alone are ambiguous |
| `BV_EXTRACTION_MODEL` | Anthropic model id when using Anthropic |

## Stack

- Next.js 16 (App Router)
- TypeScript (strict)
- Vercel AI SDK 6 + Cerebras / Anthropic
- shadcn/ui + Tailwind CSS
- Zod validation
- JSZip for image handling

## Tech notes

- Circle API auth uses `Token` scheme (not Bearer)
- Circle strips `<img>` from lesson `body_html` — images inserted via TipTap `signed_id`
- All courses created as draft
- No database, no server-side persistence — fully serverless
