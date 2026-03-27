---
id: troubleshooting
title: Troubleshooting
sidebar_position: 4
---

# Troubleshooting

## Extraction failures

### `401 Unauthorized` during extraction

Your Anthropic API key is wrong or doesn't have Claude access. Check the key in settings. Keys start with `sk-ant-`.

### Extraction times out

The SSE stream closes before a result arrives. This usually means the function hit Vercel's timeout limit. For large PDFs (50+ pages), you may need to increase `maxDuration` in `vercel.json` or upgrade your Vercel plan. See [Deployment](./technical/deployment#function-timeout).

The keepalive ping fires every 15 seconds, so the connection staying open but no result arriving usually means Claude is still working — not that the connection died.

### `Zod validation failed` after extraction

Claude returned JSON that didn't match the expected schema. This can happen with unusual PDF formatting that confuses the extraction. The error message includes which field failed.

Common causes:
- A `quiz` block with fewer than 2 `options`
- A `heading` with an invalid `level` value
- Empty `html` string in a `text` block

You can try re-running extraction — Claude's output varies between runs.

### Schema validation passes but semantic check fails

The error will say something like `Lesson "Introduction" has no content blocks` or `Duplicate section title: "Overview"`. These are checks the route runs after Zod validation. They catch valid-but-broken structures.

## Image issues

### Images not matching

The matcher uses the `alt` text from `image_placeholder` blocks as a filename hint. If your ZIP has filenames like `img001.png` and the alt text is `product roadmap diagram`, matching will fail.

Rename the images in your ZIP before uploading to match what's in the PDF's alt text. Or manually edit the extracted JSON to make the `alt` fields match your actual filenames.

### `Failed to upload image` error

Could be:
- Circle API token lacks permission for direct uploads (needs community admin)
- Image file is corrupt or an unsupported format
- Circle returned an unexpected error on the presigned URL

The error message from Circle is included in the SSE error event.

## Import failures

### `401 Unauthorized` or `403 Forbidden` from Circle

Your Circle token is wrong or doesn't have the necessary permissions. The token needs to belong to an account with access to create courses in the specified space group.

### `Missing record` retries exhausted

Circle's eventual consistency sometimes takes longer than expected. `fetchWithRetry` retries up to 4 times with increasing delays. If it exhausts retries, it's usually a sign Circle is under load. Try the import again later.

This appears as: `Error: Maximum retries exceeded for Missing record error`

### Import stopped partway through

The response includes a `partial` event with the resources created so far. Note the last successful section and lesson, then decide whether to:

1. Delete the partial course in Circle and re-run the import
2. Manually create the remaining lessons in Circle

Re-running will create a duplicate if you don't delete the partial course first.

### Lessons created but body is empty

The HTML builder returned an empty string. This usually means all blocks in the lesson were `image_placeholder` blocks (which the builder skips if not resolved) or the blocks array was empty.

Check the extracted JSON for the affected lesson.

## Circle gotchas

### Sections/lessons appear in the wrong order

Circle maintains the order based on the `position` field. The import route creates items sequentially without setting explicit positions, relying on creation order. If Circle reorders items (rare, but possible under API load), the structure may not match.

If you notice ordering issues, the cleanest fix is to reorder manually in Circle's drag-and-drop interface — it's faster than debugging the API.

### Course is created but invisible in Circle

Courses may be created in draft/private state depending on your community settings. In Circle, go to the course and publish it.

### Rate limit during large imports

A 100-lesson course triggers 100+ API calls. If Circle's rate limit is hit and the retry logic exhausts, the import stops. The partial result event tells you where it stopped.

Options:
- Delete the partial course, wait 5 minutes, re-run
- For very large courses, consider splitting the PDF and running separate imports, then using consolidate to merge
