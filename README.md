# Content Constructors 👷

Migrate beVisioneers course content from Google Doc PDFs ("Module Scripts") into Circle LMS. A conversational wizard guided by Bob the Builder.

## What it does

1. **Extract**: Upload a Module Script PDF → Claude reads it and extracts structured content (sections, lessons, flashcards, quizzes, accordions, etc.)
2. **Images**: Upload a ZIP of images → match them to placeholders in the extracted content
3. **Interactives + Import**: Paste Genially embed URLs → Import everything to Circle as draft courses

## Run locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Click ⚙️ to enter your Circle API token and Anthropic API key.

## Deploy to Vercel

Connect this repo to Vercel. No environment variables needed — all API keys are stored client-side in localStorage.

## Stack

- Next.js 15 (App Router)
- TypeScript (strict)
- Vercel AI SDK + Claude 4.6 Opus
- shadcn/ui + Tailwind CSS
- Zod validation
- JSZip for image handling

## Tech notes

- Circle API auth uses `Token` scheme (not Bearer)
- Circle strips `<img>` from lesson `body_html` — images inserted via TipTap `signed_id`
- All courses created as draft
- No database, no server-side persistence — fully serverless
