import { NextRequest } from "next/server";
import type { ImportLog } from "@/lib/types";
import { CourseStructure } from "@/lib/schema";
import { buildHtmlWithGenially } from "@/lib/html-builder";
import { createCourse, createSection, createLesson } from "@/lib/circle";

// Re-export so existing imports from this path still work
export type { ImportLog };

interface ImportRequest {
  course: CourseStructure;
  circleToken: string;
  spaceGroupId: number;
  geniallyUrls: Record<string, string>;
  imageAssignments: Record<number, string>;
}

export async function POST(req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      // Track what has been created so we can surface partial results on error
      const partial: ImportLog = {
        courseId: -1,
        courseName: "",
        sections: [],
        interactives: [],
      };

      try {
        const body: ImportRequest = await req.json();
        const { course, circleToken, spaceGroupId, geniallyUrls } = body;

        if (!course || !circleToken || !spaceGroupId) {
          send({ type: "error", message: "Missing required fields: course, circleToken, spaceGroupId", partial: null });
          controller.close();
          return;
        }

        partial.courseName = course.name;

        // Count total steps: 1 (course) + sections + lessons
        const totalLessons = course.sections.reduce(
          (sum, s) => sum + s.lessons.length,
          0
        );
        const totalSections = course.sections.length;
        const total = 1 + totalSections + totalLessons;
        let step = 0;

        send({
          type: "progress",
          message: `Creating course "${course.name}"...`,
          step,
          total,
        });

        const createdCourse = await createCourse(
          circleToken,
          course.name,
          course.slug,
          spaceGroupId
        );
        partial.courseId = createdCourse.id;
        step++;

        for (const section of course.sections) {
          send({
            type: "progress",
            message: `Creating section "${section.name}"...`,
            step,
            total,
          });

          const createdSection = await createSection(
            circleToken,
            createdCourse.id,
            section.name
          );
          step++;

          const sectionLog: ImportLog["sections"][number] = {
            id: createdSection.id,
            name: section.name,
            lessons: [],
          };
          partial.sections.push(sectionLog);

          for (const lesson of section.lessons) {
            send({
              type: "progress",
              message: `Creating lesson "${lesson.name}"...`,
              step,
              total,
            });

            // Collect Genially interactives for the log
            for (const block of lesson.blocks) {
              if (block.type === "genially_placeholder") {
                const url = geniallyUrls[block.name];
                if (url) {
                  partial.interactives.push({
                    lessonName: lesson.name,
                    placeholderName: block.name,
                    embedUrl: url,
                  });
                }
              }
            }

            // Images are preserved as [IMAGE N: description] placeholders in the HTML.
            // Circle does not support programmatic image upload via REST API.
            const bodyHtml = buildHtmlWithGenially(lesson.blocks, geniallyUrls);
            const createdLesson = await createLesson(
              circleToken,
              createdSection.id,
              lesson.name,
              bodyHtml
            );
            step++;

            sectionLog.lessons.push({
              id: createdLesson.id,
              name: lesson.name,
            });
          }
        }

        send({ type: "complete", log: partial });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Include whatever was successfully created so the user knows what to clean up
        send({
          type: "error",
          message,
          partial: partial.courseId !== -1 ? partial : null,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
