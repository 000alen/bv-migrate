---
id: consolidate
title: Consolidating Modules
sidebar_position: 6
---

# Consolidating Modules

Consolidate takes multiple existing Circle courses and merges them into a single new course. It's useful when content was imported as separate courses but needs to be a unified curriculum.

## How it works

1. You provide a list of Circle Space IDs (the course IDs you want to merge)
2. The consolidate route fetches all sections and lessons from each source course, in order
3. It creates a new course in your space group
4. All sections are created in the new course, prefixed with the source course name if there are name collisions
5. All lessons are recreated, preserving the original `body_html` exactly

The source courses are left untouched. Consolidate only reads from them.

## Input format

In the UI, enter the Circle Space IDs as a comma-separated list or one per line. You can find a course's Space ID in Circle's URL: `https://app.circle.so/c/YOUR_COMMUNITY_SLUG/courses/SPACE_ID/`.

## What's preserved

Consolidate uses the existing `body_html` from each lesson — it doesn't re-parse or re-render anything. If a lesson was originally imported with images, those images are already on Circle's CDN and referenced by `signed_id` in the HTML. They carry over correctly.

Lesson metadata (title, position within section) is preserved. Section order matches the order of source courses you provided, not alphabetical.

## What's not preserved

- Course-level settings (cover image, description, visibility) are not copied. The new course is created with defaults.
- Member enrollment is not transferred.
- Draft vs. published status is not transferred.

## Progress streaming

Like the import route, consolidate streams SSE progress events. The step count is the total number of lessons across all source courses plus the course creation steps.

## Use case

The typical workflow is:

1. Import each module as a separate course using the standard pipeline
2. Review each course in Circle and fix any issues
3. Use consolidate to combine them into the final curriculum course

This lets you verify each module independently before committing to the final structure.
