# bV Migrate — Circle LMS Import Tool

A 3-stage wizard to migrate beVisioneers course content from PDF module scripts to Circle LMS.

## Overview

This tool automates the tedious process of manually re-creating course content in Circle. Upload a Module Script PDF, let Claude extract the structured content, match images and Genially embeds, then import everything to Circle with a single click.

## Stack

- **Next.js 15** (App Router, TypeScript strict mode)
- **Tailwind CSS v4** with `@tailwindcss/postcss`
- **shadcn/ui** components (manually created)
- **Vercel AI SDK** (`@ai-sdk/anthropic` + `ai`) — `generateObject` with Claude claude-opus-4-6
- **Zod** for schema validation
- **JSZip** (available for ZIP handling)
- No database, no auth — fully serverless

## Workflow

### Stage 1 — Extract

1. Enter your API keys in the sidebar (Circle token, Anthropic key, Space Group ID)
2. Upload your beVisioneers Module Script PDF
3. Claude claude-opus-4-6 reads the PDF and extracts a fully-typed `CourseStructure` JSON
4. Review and edit the extracted structure in the tree view
5. Each block type is color-coded and editable via JSON modal

### Stage 2 — Image Matching

- All `image_placeholder` blocks are listed with their index and description
- Upload image files to match each placeholder
- Thumbnails preview the matched images

### Stage 3 — Import

- All `genially_placeholder` blocks are listed
- Paste the Genially embed URLs for each interactive element
- Click **Import to Circle** — SSE stream shows live progress
- Download the import log JSON with all Circle IDs for your records

## Content Block Types

| Type | Description |
|------|-------------|
| `text` | Rich HTML text block |
| `heading` | H2/H3/H4 heading |
| `flashcard` | Q&A flashcard pairs |
| `accordion` | Expandable tabs |
| `quiz` | Multiple choice with feedback |
| `labeled_image` | Image with clickable labels |
| `sorting_activity` | Categorization activity |
| `timeline` | Step-by-step timeline |
| `padlet` | Padlet embed placeholder |
| `checklist` | Checkbox list |
| `button_stack` | CTA buttons with descriptions |
| `image_placeholder` | Image upload slot (matched in Stage 2) |
| `genially_placeholder` | Genially embed (linked in Stage 3) |
| `quote` | Block quote |
| `file_attachment` | File download reference |
| `survey_embed` | Survey embed placeholder |
| `divider` | Horizontal rule |

## Setup

```bash
npm install --legacy-peer-deps
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment / Keys

All keys are stored in `localStorage` (client-side only, never sent to a server except your own API routes):

| Key | Storage key | Where to find |
|-----|-------------|---------------|
| Circle API Token | `bv_circle_token` | Circle → Settings → API |
| Anthropic API Key | `bv_anthropic_key` | console.anthropic.com |
| Space Group ID | `bv_space_group_id` | Circle → Community Settings |

## API Routes

### `POST /api/extract`

- **Headers:** `x-anthropic-key: sk-ant-...`
- **Body:** `multipart/form-data` with `pdf` field
- **Response:** `CourseStructure` JSON

### `POST /api/import`

- **Body:** `{ course, circleToken, spaceGroupId, geniallyUrls, imageAssignments }`
- **Response:** `text/event-stream` SSE with progress events and final import log

## Circle API

Uses Circle Admin API v2:
- `POST /courses` — create course
- `POST /course_sections` — create section
- `POST /course_lessons` — create lesson with HTML body

Genially placeholders are replaced with responsive iframe embeds (16:9 aspect ratio).

## Brand Colors

| Name | Hex |
|------|-----|
| Black | `#000000` |
| White | `#FFFFFF` |
| Light Gray | `#F5F6F1` |
| Purple | `#CE99F2` |
| Yellow | `#F9FB75` |
| Orange | `#F99756` |
| Cyan | `#95E1ED` |

## Project Structure

```
app/
  globals.css          # Tailwind v4 + CSS custom properties
  layout.tsx           # Root layout with Toaster
  page.tsx             # Main wizard (client component)
  api/
    extract/route.ts   # PDF to CourseStructure via Claude
    import/route.ts    # CourseStructure to Circle LMS (SSE)
components/
  api-key-form.tsx     # Sidebar key inputs with localStorage
  pdf-upload.tsx       # Stage 1: PDF dropzone + extract
  content-preview.tsx  # Stage 1: editable course tree
  image-matcher.tsx    # Stage 2: image assignment UI
  genially-linker.tsx  # Stage 3: URL inputs + import trigger
  import-progress.tsx  # Stage 3: SSE progress + log display
  ui/                  # shadcn/ui components
lib/
  schema.ts            # Zod schemas + TypeScript types
  html-builder.ts      # ContentBlock[] to Circle HTML
  circle.ts            # Circle API client
  utils.ts             # cn() utility
hooks/
  use-toast.ts         # Toast state management
```
