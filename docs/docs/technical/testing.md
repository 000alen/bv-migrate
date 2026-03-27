---
id: testing
title: Testing
sidebar_position: 4
---

# Testing

The test suite has two layers: unit tests for pure functions and integration tests that hit real APIs.

## Unit tests

```bash
pnpm test
```

Uses Vitest. Tests cover:
- `lib/html-builder.ts` — every block type renders expected HTML
- `lib/schema.ts` — validation accepts valid blocks and rejects malformed ones
- `lib/sse.ts` — stream creation, event writing, client-side parsing

No mocks of Circle or Anthropic — unit tests only cover the pure logic.

## Integration tests

```bash
pnpm test:integration
```

These tests hit real APIs. You need environment variables set:

```bash
export CIRCLE_TOKEN=your_circle_token
export ANTHROPIC_KEY=your_anthropic_key
export CIRCLE_SPACE_GROUP_ID=your_space_group_id
```

**Warning**: integration tests create real resources in your Circle community. They clean up after themselves (see sweep), but something could go wrong. Don't run against a production community without understanding the cleanup behavior.

### What the integration tests cover

**`extract-flow.test.ts`** — Generates a minimal PDF in memory, posts it to `/api/extract`, consumes the SSE stream, and validates the result against `CourseStructureSchema`. Tests that keepalive pings arrive during long extractions.

**`import-flow.test.ts`** — Takes a test `CourseStructure`, posts it to `/api/import`, and verifies the created resources exist in Circle. Checks that sections and lessons are in the right order and that lesson HTML contains expected content.

**`image-upload-flow.test.ts`** — Tests the Circle direct upload API directly. Generates a 2×2 PNG in memory, uploads it via `createDirectUpload` + `uploadFile`, and verifies the returned `signed_id` is a valid Base64 string. Does not create a full course.

**`consolidate-flow.test.ts`** — Creates two test courses in Circle, then runs consolidate to merge them. Verifies the merged course has all sections from both sources in order.

**`partial-failure.test.ts`** — Tests the partial failure path. Uses a test helper that injects a failure at a specific step. Verifies the response includes the resources created before the failure and doesn't include the ones that weren't.

**`circle-crud.test.ts`** — Direct tests of `lib/circle.ts` functions. Creates and reads courses, sections, and lessons. Tests that `fetchWithRetry` retries on 429 and "Missing record" responses.

### Test helpers

**`tests/integration/helpers/test-pdf.ts`** — Generates a minimal valid PDF-1.4 from scratch. No external dependencies. The PDF contains structured text that Claude can extract into a predictable `CourseStructure`. Deterministic, so the extracted result is consistent across runs.

**`tests/integration/helpers/test-image.ts`** — Generates a 2×2 PNG from raw bytes. Valid PNG header, IHDR, IDAT, and IEND chunks. No image library required.

**`tests/integration/helpers/test-course.ts`** — Returns a hardcoded `CourseStructure` with one instance of every content block type. Used by import tests to verify all block types render and import correctly.

**`tests/integration/helpers/circle-test-client.ts`** — Wraps `lib/circle.ts` with resource tracking. Every create call registers the created resource. After the test, `cleanup()` deletes everything. Also has `sweep()` which finds all resources in your space group with the `[TEST]` prefix and deletes them — useful if a previous test run left orphans.

## Sweep

```bash
pnpm test:sweep
```

Runs `sweep.test.ts` which calls `circle-test-client.sweep()`. Finds any Circle resources prefixed with `[TEST]` and deletes them. Run this if integration tests failed and left resources behind.

## Running a single test

```bash
pnpm test:integration -- --reporter=verbose tests/integration/import-flow.test.ts
```

## CI

Integration tests don't run in CI by default — they require API keys and create live resources. The standard CI job runs unit tests only.

If you want to run integration tests in CI (e.g., on a schedule), add the required secrets to your GitHub Actions environment and run with `pnpm test:integration`.
