---
id: genially
title: Genially Embeds
sidebar_position: 4
---

# Genially Embeds

Genially is an interactive content platform. Some courses have Genially interactives that need to be preserved as embeds in the Circle lessons.

## The genially_placeholder block

During extraction, Claude may produce `genially_placeholder` blocks if it finds references to Genially content in the PDF (usually links or embed codes). These have:

```json
{
  "type": "genially_placeholder",
  "title": "Module 3 Interactive",
  "genially_id": "abc123def456"
}
```

The `genially_id` is the identifier needed for the embed URL.

## How embeds work

When the HTML builder encounters a `genially_placeholder` block, it generates an iframe embed:

```html
<div class="genially-embed">
  <iframe
    src="https://view.genial.ly/abc123def456"
    frameborder="0"
    allowfullscreen
    width="100%"
    height="600"
  ></iframe>
</div>
```

This gets injected into the lesson body HTML and renders in Circle as an embedded interactive.

## Genially IDs from PDF links

If the PDF contains a Genially link like `https://view.genial.ly/abc123def456`, Claude extracts the ID portion (`abc123def456`). If the PDF has a QR code or a text mention without a link, Claude may not be able to extract the ID — in that case you'll see a `genially_placeholder` with a `title` but an empty or absent `genially_id`.

For placeholders with missing IDs, the HTML builder renders a visible note in the lesson: "Genially interactive: [title] — embed URL required". You can fix these manually in Circle after import.

## Reviewing before import

The extracted JSON is visible in the UI before you trigger the import. Look for `genially_placeholder` blocks and verify that `genially_id` values look correct (they're alphanumeric strings, 12-24 characters). If any are wrong, the cleanest fix is to correct the extracted JSON directly in the UI before proceeding.
