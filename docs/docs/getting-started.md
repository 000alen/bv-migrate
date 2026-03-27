---
id: getting-started
title: Getting Started
sidebar_position: 2
---

# Getting Started

## Prerequisites

You need:

- A Circle community with course creation enabled
- A Circle API token (Settings → API → Personal tokens)
- An Anthropic API key with Claude access
- The Space Group ID of the Circle space group where courses will be created

## Deployment

The easiest path is Vercel. The app has no backend state, so a free tier deployment works fine.

```bash
git clone https://github.com/blader/bv-migrate
cd bv-migrate
pnpm install
```

Deploy to Vercel:

```bash
npx vercel
```

No environment variables are required on the server. All keys are entered in the app's settings drawer and stored in `localStorage`.

### Running locally

```bash
pnpm dev
```

Opens at `http://localhost:3000`.

## First-time setup

When you open the app, you'll see the welcome screen:

![Welcome screen](/img/screenshots/01-welcome.png)

Click the settings gear to open the settings drawer:

![Settings drawer](/img/screenshots/02-settings.png)

Enter your:
- **Anthropic API key** — starts with `sk-ant-`
- **Circle API token** — from Circle Settings → API
- **Circle Space Group ID** — the numeric ID of your space group

These are saved to `localStorage` immediately. Nothing is sent to the server.

## Finding your Space Group ID

In Circle, go to your community settings. The Space Group ID is in the URL when you're viewing a space group, or in the API:

```bash
curl -H "Authorization: Token YOUR_TOKEN" \
  "https://app.circle.so/api/v2/space_groups/?community_id=YOUR_COMMUNITY_ID"
```

The `id` field in the response is what you need.

## Verifying your setup

With keys entered, the welcome screen lets you pick a content type. If your Circle token or Space Group ID is wrong, you'll see an error when the import step tries to create a course. The Anthropic key is validated during extraction — a bad key produces a 401 error from the Claude API, surfaced as an extraction failure.
