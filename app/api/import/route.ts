import { NextRequest } from "next/server";
import { CourseStructure } from "@/lib/schema";
import { buildHtmlWithGenially } from "@/lib/html-builder";
import { createCourse, createSection, createLesson } from "@/lib/circle";

export interface ImportLog {
  courseId: number;
  courseName: string;
  sections: Array<{
    id: number;
    name: string;
    lessons: Array<{ id: number; name: string }>;
  }>;
  interactives: Array<{
    lessonName: string;
    placeholderName: string;
    embedUrl: string;
  }>;
}

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

      try {
        const body: ImportRequest = await req.json();
        const { course, circleToken, spaceGroupId, geniallyUrls } = body;

        if (!course || !circleToken || !spaceGroupId) {
          send({ type: "error", message: "Missing required fields: course, circleToken, spaceGroupId" });
          controller.close();
          return;
        }

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
        step++;

        const log: ImportLog = {
          courseId: createdCourse.id,
          courseName: course.name,
          sections: [],
          interactives: [],
        };

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

          for (const lesson of section.lessons) {
            send({
              type: "progress",
              message: `Creating lesson "${lesson.name}"...`,
              step,
              total,
            });

            // Collect interactives for this lesson
            for (const block of lesson.blocks) {
              if (block.type === "genially_placeholder") {
                const url = geniallyUrls[block.name];
                if (url) {
                  log.interactives.push({
                    lessonName: lesson.name,
                    placeholderName: block.name,
                    embedUrl: url,
                  });
                }
              }
            }

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

          log.sections.push(sectionLog);
        }

        send({ type: "complete", log });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        send({ type: "error", message });
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
