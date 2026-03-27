---
id: intro
title: Introduction
sidebar_position: 1
slug: /
---

# Content Constructors

Content Constructors is a Next.js app that migrates course content into [Circle](https://circle.so). You give it a PDF and a ZIP of images, it extracts structured content using Claude, matches images to placeholders, and imports everything as a fully-formed course with sections and lessons.

It's built for one specific workflow: taking polished course material (usually exported from Articulate or similar tools) and getting it into Circle without manually recreating every lesson.

## What it does

The tool runs a three-stage pipeline:

1. **Extract** — Upload a PDF. Claude reads it and produces a structured JSON course with sections, lessons, and typed content blocks (text, headings, quizzes, flashcards, etc.).

2. **Inject images** — Upload a ZIP of images. The tool matches images to `image_placeholder` blocks in the extracted content using fuzzy filename matching, then uploads them to Circle's CDN.

3. **Import** — Send the structured course to Circle's API. The tool creates a course, sections, and lessons in order, injecting the correct `signed_id` references for uploaded images.

There's also a **consolidate** mode that merges multiple existing Circle courses into one, pulling sections and lessons from source spaces and combining them under a new course.

## Who it's for

Teams using Circle as their LMS who have existing course content in PDFs and need to get it in without spending hours copying text into the Circle editor.

The tool runs entirely in the browser (after deployment). API keys are stored in `localStorage` — there's no server-side key storage, no database, no accounts.

## Stack

- **Next.js 15** with App Router, deployed to Vercel
- **Vercel AI SDK** (`ai` package) with `@ai-sdk/anthropic` for Claude extraction
- **Circle API v2** for course/section/lesson creation and direct image uploads
- **shadcn/ui** for the interface
- **Zod** for schema validation at every stage of the pipeline
- **SSE** for streaming progress back to the browser during extraction and import
