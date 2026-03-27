import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { CourseStructure, ContentBlock } from "@/lib/schema";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function collectBlocks<T extends ContentBlock["type"]>(
  course: CourseStructure,
  type: T
): Array<{ block: Extract<ContentBlock, { type: T }>; section: string; lesson: string }> {
  const result: Array<{ block: Extract<ContentBlock, { type: T }>; section: string; lesson: string }> = [];
  for (const section of course.sections) {
    for (const lesson of section.lessons) {
      for (const block of lesson.blocks) {
        if (block.type === type) {
          result.push({
            block: block as Extract<ContentBlock, { type: T }>,
            section: section.name,
            lesson: lesson.name,
          });
        }
      }
    }
  }
  return result;
}
