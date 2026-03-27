---
id: images
title: Image Injection
sidebar_position: 3
---

# Image Injection

After extraction, if the course has `image_placeholder` blocks, you can upload a ZIP of images to match and inject them.

## How matching works

Each `image_placeholder` block has an `alt` field — this is the original image filename or descriptive text Claude extracted from the PDF. The matching algorithm normalizes both the ZIP entry filenames and the `alt` values (lowercase, strip extension, replace separators with spaces) then finds the closest match.

The matching is fuzzy. A ZIP entry named `01_product_overview.png` will match an `alt` of `product overview` or `01 product overview`. An exact match wins, but partial matches work for images where the PDF had descriptive alt text rather than raw filenames.

If no match is found for a placeholder, the block remains as `image_placeholder` in the output. The import step skips unmatched placeholders rather than failing.

## What happens when a match is found

1. The matched image file is uploaded to Circle's direct upload API (`POST /api/v2/direct_uploads`)
2. Circle returns a `signed_id`
3. The `image_placeholder` block is replaced with an `image` block:

```json
{
  "type": "image",
  "alt": "product overview diagram",
  "signed_id": "eyJfcmFpbHMiOiJC..."
}
```

The `signed_id` is what Circle's lesson HTML needs to reference an uploaded image. It's injected into the lesson body HTML as a `<action-text-attachment>` element.

## Upload format

Circle's direct upload API requires:

1. `POST /api/v2/direct_uploads` with `{ byte_size, checksum, content_type, filename }` to get a presigned S3 URL
2. `PUT` to that S3 URL with the raw file bytes and `Content-Type` header
3. Use the returned `signed_id` in your HTML

The tool handles all three steps. The `lib/circle.ts` `createDirectUpload` and `uploadFile` functions wrap this.

## Image formats

Circle accepts standard web image formats. The tool doesn't transcode — it sends whatever is in the ZIP. JPEG and PNG are safe. WebP works in most Circle deployments. Avoid TIFF or BMP.

## Skipping images

If you skip the image step, any `image_placeholder` blocks in the extracted content are converted to a visible placeholder in the lesson HTML — a styled `<div>` with the alt text and a note that the image wasn't provided. This keeps the lesson structure intact without breaking the import.
