import { NextRequest } from "next/server";
import crypto from "node:crypto";
import type { ImportLog } from "@/lib/types";
import { CourseStructure } from "@/lib/schema";
import { buildHtmlWithGenially } from "@/lib/html-builder";
import {
  createCourse,
  createSection,
  createLesson,
  createDirectUpload,
  uploadFile,
} from "@/lib/circle";

export type { ImportLog };

interface ImageDatum {
  filename: string;
  dataUrl: string;
}

interface ImportRequest {
  course: CourseStructure;
  circleToken: string;
  spaceGroupId: number;
  geniallyUrls: Record<string, string>;
  imageAssignments: Record<number, string>;
  imageData?: Record<number, ImageDatum>;
}

function md5Base64(buf: Buffer): string {
  return crypto.createHash("md5").update(buf).digest("base64");
}

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; contentType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { contentType: match[1], buffer: Buffer.from(match[2], "base64") };
}

export async function POST(req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      const partial: ImportLog = {
        courseId: -1,
        courseName: "",
        sections: [],
        interactives: [],
        uploadedImages: [],
      };

      try {
        const body: ImportRequest = await req.json();
        const { course, circleToken, spaceGroupId, geniallyUrls, imageData } = body;

        if (!course || !circleToken || !spaceGroupId) {
          send({ type: "error", message: "Missing required fields: course, circleToken, spaceGroupId", partial: null });
          controller.close();
          return;
        }

        partial.courseName = course.name;

        const totalLessons = course.sections.reduce((sum, s) => sum + s.lessons.length, 0);
        const totalSections = course.sections.length;
        const total = 1 + totalSections + totalLessons;
        let step = 0;

        send({ type: "progress", message: `Creating course "${course.name}"...`, step, total });

        const createdCourse = await createCourse(circleToken, course.name, course.slug, spaceGroupId);
        partial.courseId = createdCourse.id;
        step++;

        for (const section of course.sections) {
          send({ type: "progress", message: `Creating section "${section.name}"...`, step, total });

          const createdSection = await createSection(circleToken, createdCourse.id, section.name);
          step++;

          const sectionLog: ImportLog["sections"][number] = {
            id: createdSection.id,
            name: section.name,
            lessons: [],
          };
          partial.sections.push(sectionLog);

          for (const lesson of section.lessons) {
            send({ type: "progress", message: `Creating lesson "${lesson.name}"...`, step, total });

            // Collect Genially interactives for the log
            for (const block of lesson.blocks) {
              if (block.type === "genially_placeholder") {
                const url = geniallyUrls[block.name];
                if (url) {
                  partial.interactives.push({ lessonName: lesson.name, placeholderName: block.name, embedUrl: url });
                }
              }
            }

            // Upload images to Circle CDN if imageData provided
            const signedIds: Record<number, string> = {};
            if (imageData) {
              for (const block of lesson.blocks) {
                if (block.type === "image_placeholder") {
                  const datum = imageData[block.index];
                  if (!datum) continue;
                  try {
                    const parsed = dataUrlToBuffer(datum.dataUrl);
                    if (!parsed) continue;
                    const { buffer, contentType } = parsed;
                    const checksum = md5Base64(buffer);
                    const upload = await createDirectUpload(
                      circleToken,
                      datum.filename,
                      buffer.length,
                      contentType,
                      checksum
                    );
                    await uploadFile(upload.direct_upload.url, upload.direct_upload.headers, buffer);
                    signedIds[block.index] = upload.signed_id;
                    partial.uploadedImages!.push({
                      lessonName: lesson.name,
                      placeholderIndex: block.index,
                      description: block.description,
                      signedId: upload.signed_id,
                    });
                  } catch (imgErr) {
                    // Non-fatal: keep as placeholder if upload fails
                    console.warn(`Image upload failed for [IMAGE ${block.index}]:`, imgErr);
                  }
                }
              }
            }

            let bodyHtml = buildHtmlWithGenially(lesson.blocks, geniallyUrls);

            // Replace image placeholders with signed_id info where uploaded
            for (const block of lesson.blocks) {
              if (block.type === "image_placeholder" && signedIds[block.index]) {
                const placeholder = `[IMAGE ${block.index}: ${block.description}]`;
                const replacement = `<p>📷 <strong>[IMAGE: ${block.description}]</strong></p><p><em>Image uploaded to Circle CDN (signed_id: ${signedIds[block.index]}). Insert via Circle editor.</em></p>`;
                bodyHtml = bodyHtml.split(placeholder).join(replacement);
              }
            }

            const createdLesson = await createLesson(circleToken, createdSection.id, lesson.name, bodyHtml);
            step++;

            sectionLog.lessons.push({ id: createdLesson.id, name: lesson.name });
          }
        }

        send({ type: "complete", log: partial });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
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
