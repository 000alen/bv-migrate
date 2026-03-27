---
id: deployment
title: Deployment
sidebar_position: 5
---

# Deployment

## Vercel (recommended)

The app deploys to Vercel with no configuration required. There are no required server-side environment variables — API keys come from the browser on each request.

```bash
npx vercel
```

On first deploy, Vercel auto-detects Next.js and sets the build command to `next build`. That's correct.

### Function timeout

The extraction route can take 60-90 seconds for large PDFs. Vercel's default function timeout is 10 seconds on the hobby tier, 30 seconds on pro, and configurable on enterprise.

You need either:
- A pro/enterprise plan with a longer timeout, or
- The hobby tier with `maxDuration` set in `vercel.json`:

```json
{
  "functions": {
    "app/api/extract/route.ts": {
      "maxDuration": 120
    },
    "app/api/import/route.ts": {
      "maxDuration": 120
    },
    "app/api/consolidate/route.ts": {
      "maxDuration": 120
    }
  }
}
```

Note: hobby tier can't exceed 60 seconds. If you're hitting limits, upgrade or self-host.

### Streaming responses on Vercel

Vercel supports Next.js streaming responses natively. The SSE routes use `new Response(stream)` with appropriate headers — this works without any special configuration.

## Self-hosting

The app is a standard Next.js application. Any Node.js hosting that supports Next.js App Router works.

```bash
pnpm build
pnpm start
```

For self-hosting with Docker, use the Next.js standalone output:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install -g pnpm && pnpm install && pnpm build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Add `output: 'standalone'` to `next.config.js` for the standalone build.

## Environment variables

There are no required server-side environment variables for production. Everything is user-provided at runtime.

Optional variables you might want:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | Used for absolute URLs in SSE responses. Defaults to the request origin. |

## Docs deployment

Documentation (this site) deploys to GitHub Pages via the workflow at `.github/workflows/deploy-docs.yml`. It triggers on pushes to `main` that change files in the `docs/` directory.

To build docs locally:

```bash
pnpm docs:build
```

To preview locally:

```bash
pnpm docs:dev
```
