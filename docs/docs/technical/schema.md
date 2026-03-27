---
id: schema
title: Content Block Schema
sidebar_position: 3
---

# Content Block Schema

All content is represented as an array of typed blocks. The schema lives in `lib/schema.ts` and uses Zod for validation.

## Block types

### text

Free-form HTML content.

```typescript
{ type: "text", html: string }
```

The `html` field contains valid HTML. Claude generates this from prose paragraphs in the PDF.

### heading

```typescript
{ type: "heading", level: 1 | 2 | 3 | 4, text: string }
```

### image

A resolved image with a Circle `signed_id`.

```typescript
{ type: "image", alt: string, signed_id: string }
```

### image_placeholder

An unresolved image reference. Produced by extraction when Claude finds an image in the PDF that hasn't been uploaded yet.

```typescript
{ type: "image_placeholder", alt: string }
```

The `alt` field is used as the filename hint for ZIP matching.

### quiz

Multiple-choice question.

```typescript
{
  type: "quiz",
  question: string,
  options: string[],
  correct: number,       // 0-indexed
  explanation?: string
}
```

### flashcard

```typescript
{ type: "flashcard", front: string, back: string }
```

### accordion

Collapsible section with a title and body.

```typescript
{ type: "accordion", title: string, body: string }
```

### timeline

Ordered sequence of dated events.

```typescript
{
  type: "timeline",
  items: Array<{ date: string, title: string, description?: string }>
}
```

### labeled_image

Image with callout labels at specific positions.

```typescript
{
  type: "labeled_image",
  src: string,
  alt: string,
  labels: Array<{ x: number, y: number, text: string }>
}
```

### sorting_activity

Drag-and-drop sorting exercise.

```typescript
{
  type: "sorting_activity",
  prompt: string,
  items: string[],
  correct_order: number[]   // indices into items[]
}
```

### padlet

```typescript
{ type: "padlet", url: string, title?: string }
```

### checklist

```typescript
{
  type: "checklist",
  items: Array<{ text: string, checked?: boolean }>
}
```

### button_stack

One or more buttons with labels and URLs.

```typescript
{
  type: "button_stack",
  buttons: Array<{ label: string, url: string }>
}
```

### genially_placeholder

Reference to a Genially interactive that hasn't been resolved to an embed.

```typescript
{ type: "genially_placeholder", title: string, genially_id?: string }
```

### quote

```typescript
{ type: "quote", text: string, attribution?: string }
```

### file_attachment

```typescript
{ type: "file_attachment", filename: string, url: string }
```

### survey_embed

```typescript
{ type: "survey_embed", url: string, title?: string }
```

### divider

```typescript
{ type: "divider" }
```

---

## CourseStructure

The top-level extraction result:

```typescript
{
  title: string,
  sections: Array<{
    title: string,
    lessons: Array<{
      title: string,
      blocks: ContentBlock[]
    }>
  }>
}
```

## Validation

`lib/schema.ts` exports:

- `ContentBlockSchema` — discriminated union of all 18 block types
- `LessonSchema` — `{ title, blocks: ContentBlockSchema[] }`
- `SectionSchema` — `{ title, lessons: LessonSchema[] }`
- `CourseStructureSchema` — `{ title, sections: SectionSchema[] }`

The extraction route validates against `CourseStructureSchema` after Claude's response. The import route validates the request body before beginning any Circle API calls.
