---
id: architecture
title: Architecture
sidebar_position: 1
---

# Architecture

Content Constructors is a Next.js 15 App Router application. The server is stateless — no database, no session storage. All user state (API keys, extracted content in progress) lives in the browser.

## Request flow

```
Browser → Next.js App Router
             ├── /api/extract    (PDF → SSE stream of ContentBlocks)
             ├── /api/import     (CourseStructure → SSE stream of progress)
             └── /api/consolidate (Space IDs → SSE stream of progress)
```

Each API route returns a streaming SSE response. The browser consumes events using `lib/sse.ts`'s `consumeSSE()`.

## Key modules

### `lib/schema.ts`

Zod schemas for all 18 content block types, plus `CourseStructure` (the top-level extraction output). This schema is the contract between extraction and import. If extraction produces something that doesn't validate here, the pipeline stops.

### `lib/circle.ts`

The Circle API client. Wraps `fetch` with:
- Auth headers (`Authorization: Token ...`)
- Rate pacing (delay between requests)
- `fetchWithRetry` with exponential backoff for 429s, 5xx errors, and Circle's "Missing record" eventual consistency errors (returned as 422 with `"Missing record"` in the body)

### `lib/html-builder.ts`

Pure function. Takes a `ContentBlock[]` and returns an HTML string. No side effects. Called by the import route when building each lesson's `body_html`.

### `lib/sse.ts`

Two sides:
- **Server side**: `createSSEStream()` returns a `{ stream, writer }`. The route writes events with `writer.write()` and closes with `writer.close()`.
- **Client side**: `consumeSSE(response)` is an async generator. Yields parsed `{ event, data }` objects as they arrive.

## Data flow for a standard import

```
1. Browser POSTs PDF to /api/extract
2. Route opens SSE stream
3. Route calls generateObject(pdf, CourseStructureSchema)
4. Claude returns structured JSON
5. Route validates with Zod + semantic checks
6. Route sends "result" SSE event with JSON
7. Browser stores CourseStructure in state

(optional image step)
8. Browser POSTs ZIP to /api/import with shouldUploadImages: true
9. Route matches ZIP entries to image_placeholder blocks
10. Route calls createDirectUpload + uploadFile for each matched image
11. Matched blocks become "image" blocks with signed_id

12. Browser POSTs CourseStructure to /api/import
13. Route creates course, then sections, then lessons in order
14. Route sends progress SSE events
15. Route sends "complete" event with courseId + courseUrl
```

## No server-side key storage

API keys are sent from the browser on each request in the request headers:
- `X-Anthropic-Key: sk-ant-...`
- `X-Circle-Token: ...`
- `X-Circle-Space-Group-Id: ...`

The server uses them for that request and discards them. There's no caching, no `.env` requirement for user-facing secrets in production.

## Deployment

Vercel. The app has no long-running processes outside of the SSE streams, which Vercel handles fine with its streaming response support. See [Deployment](./deployment).
