---
id: overview
title: The Wizard Flow
sidebar_position: 1
---

# The Wizard Flow

The app is a linear wizard. Each step unlocks the next. You can't import before extracting, and you can't inject images before having content to inject into.

## Steps

### 1. Choose a module number

![Module number picker](/img/screenshots/03-number-select.png)

Pick which module number this course will be. This prefixes section names in Circle (e.g., "Module 3: Introduction"). It's mostly cosmetic — it affects how sections are labeled in Circle, not the content.

### 2. Upload PDF

![PDF upload](/img/screenshots/04-pdf-upload.png)

Drop a PDF. The file is sent to `/api/extract` via multipart form. The extraction streams progress back over SSE — you'll see a progress indicator while Claude reads the PDF.

Extraction produces:
- A course title
- An ordered list of sections, each with a title
- An ordered list of lessons per section, each with a title and array of content blocks

The raw JSON is shown in the UI so you can inspect what was extracted before proceeding.

### 3. Inject images (optional)

If your content has images, upload a ZIP file containing them. The tool matches ZIP entries to `image_placeholder` blocks using the `alt` text as a filename hint, uploads matched images to Circle's CDN, and replaces placeholders with `image` blocks that have `signed_id` references.

You can skip this step if the content has no images.

### 4. Import to Circle

The structured course (with or without images) gets sent to `/api/import`. This creates:
- One Circle course
- One Circle section per top-level section
- One Circle lesson per lesson, with HTML body generated from the content blocks

Progress streams over SSE. If something fails partway through, the response includes what was created so far — you won't silently lose partially-created content.

### 5. Done

After a successful import, the app shows a link to the created course in Circle.

## The consolidate flow

Consolidate is a separate path on the welcome screen. Instead of uploading new content, you provide the Circle IDs of existing courses. The tool fetches their sections and lessons and combines them into a new course.

See [Consolidate](./consolidate) for details.
