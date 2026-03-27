import { z } from "zod";

export const ContentBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), html: z.string() }),
  z.object({
    type: z.literal("heading"),
    level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
    text: z.string(),
  }),
  z.object({
    type: z.literal("flashcard"),
    cards: z.array(z.object({ front: z.string(), back: z.string() })),
  }),
  z.object({
    type: z.literal("accordion"),
    tabs: z.array(z.object({ title: z.string(), content: z.string() })),
  }),
  z.object({
    type: z.literal("quiz"),
    question: z.string(),
    options: z.array(z.string()),
    correctIndex: z.number().int().min(0),
    feedbackCorrect: z.string(),
    feedbackIncorrect: z.string(),
  }),
  z.object({
    type: z.literal("labeled_image"),
    description: z.string(),
    labels: z.array(z.object({ title: z.string(), content: z.string() })),
  }),
  z.object({
    type: z.literal("sorting_activity"),
    description: z.string(),
    categories: z.array(
      z.object({ name: z.string(), items: z.array(z.string()) })
    ),
  }),
  z.object({
    type: z.literal("timeline"),
    description: z.string(),
    steps: z.array(z.object({ title: z.string(), content: z.string() })),
  }),
  z.object({ type: z.literal("padlet"), description: z.string() }),
  z.object({ type: z.literal("checklist"), items: z.array(z.string()) }),
  z.object({
    type: z.literal("button_stack"),
    buttons: z.array(
      z.object({ label: z.string(), url: z.string(), description: z.string() })
    ),
  }),
  z.object({
    type: z.literal("image_placeholder"),
    index: z.number().int().min(0),
    description: z.string(),
  }),
  z.object({
    type: z.literal("genially_placeholder"),
    name: z.string(),
    description: z.string(),
  }),
  z.object({ type: z.literal("quote"), content: z.string() }),
  z.object({
    type: z.literal("file_attachment"),
    name: z.string(),
    description: z.string(),
  }),
  z.object({ type: z.literal("survey_embed"), description: z.string() }),
  z.object({ type: z.literal("divider") }),
]);

export type ContentBlock = z.infer<typeof ContentBlockSchema>;

export const LessonSchema = z.object({
  name: z.string(),
  blocks: z.array(ContentBlockSchema),
});

export const SectionSchema = z.object({
  name: z.string(),
  lessons: z.array(LessonSchema),
});

export const CourseStructureSchema = z.object({
  name: z.string(),
  slug: z.string(),
  sections: z.array(SectionSchema),
});

export type Lesson = z.infer<typeof LessonSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type CourseStructure = z.infer<typeof CourseStructureSchema>;
