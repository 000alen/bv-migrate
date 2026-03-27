---
id: circle-api
title: Circle API
sidebar_position: 2
---

# Circle API

Circle's v2 API has a few quirks that took some time to figure out. This page documents what the tool does to handle them.

## Authentication

Personal API tokens go in the `Authorization` header:

```
Authorization: Token YOUR_TOKEN
```

Tokens have the same permissions as the account that created them. Use an account with community admin or course management permissions.

## Endpoints used

| Purpose | Method | Endpoint |
|---------|--------|----------|
| Create course | POST | `/api/v2/spaces` |
| Create section | POST | `/api/v2/course_sections` |
| Create lesson | POST | `/api/v2/course_lessons` |
| Get sections | GET | `/api/v2/course_sections?space_id=X` |
| Get lessons | GET | `/api/v2/course_lessons?space_id=X` |
| Get lesson detail | GET | `/api/v2/course_lessons/:id` |
| Create direct upload | POST | `/api/v2/direct_uploads` |

All requests go to `https://app.circle.so`.

## Creating a course

A "course" in Circle's API is a space with `space_type: "course"`. Creating one:

```json
POST /api/v2/spaces
{
  "name": "Introduction to Product Management",
  "space_group_id": 12345,
  "space_type": "course"
}
```

The returned `id` is the Space ID used for all subsequent section and lesson creation.

## Rate limits

Circle enforces rate limits but doesn't document them precisely. In practice, rapid sequential lesson creation triggers 429 responses. The tool paces requests with a short delay between creates. The `fetchWithRetry` function handles 429s with exponential backoff:

- Initial delay: 1 second
- Backoff multiplier: 2x
- Max retries: 4

If all 4 retries fail, the error propagates and the import stops with a partial result.

## The "Missing record" 422

This is Circle's eventual consistency behavior. After creating a section, if you immediately try to create a lesson in that section, Circle sometimes returns:

```
HTTP 422 Unprocessable Entity
{"message": "Missing record"}
```

This isn't a real error — the section exists, Circle just hasn't fully indexed it yet. The fix is a short wait and retry. `fetchWithRetry` detects this specific condition (422 with "Missing record" in the body) and retries with a 1-second delay.

The condition typically resolves within 1-2 seconds. In testing, it's never required more than 2 retries.

## Direct uploads for images

Circle uses a three-step process for image uploads:

**Step 1** — Get a presigned URL:

```json
POST /api/v2/direct_uploads
{
  "byte_size": 45231,
  "checksum": "base64-md5-hash",
  "content_type": "image/png",
  "filename": "diagram.png"
}
```

Response includes `direct_upload.url` (S3 presigned PUT URL) and `signed_id`.

**Step 2** — Upload to S3:

```
PUT {direct_upload.url}
Content-Type: image/png
[raw bytes]
```

**Step 3** — Use the `signed_id` in lesson HTML:

```html
<action-text-attachment sgid="eyJfcmFpbHMiOiJC..."></action-text-attachment>
```

The `signed_id` from step 1 is what Circle uses to resolve the uploaded file. It doesn't change. Store it alongside the content block.

## Pagination

The lessons and sections endpoints return paginated results. The tool fetches all pages by checking `meta.next_page` and looping. In practice, courses with more than 25 lessons in a single section will require multiple pages.

## API version

The tool uses v2 endpoints throughout. Circle has a v1 API that's still accessible but missing some newer features. Don't mix them — auth and response formats differ.
