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

// Re-export so existing imports from this path still work
export type { ImportLog };

interface ImportRequest {
  course: CourseStructure;
  circleToken: string;
  spaceGroupId: number;
  geniallyUrls: Record<string, string>;
  /** placeholder index → base64 data URL */
  imageAssignments: Record<number, string>;
}

function md5Base64(buf: Buffer): string {
  return crypto.createHash("md5").update(buf).digest("base64");
}

function parseDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } | null {
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

      // Track what has been created so we can surface partial results on error
      const partial: ImportLog = {
        courseId: -1,
        courseName: "",
        sections: [],
        interactives: [],
        uploadedImages: [],
      };

      try {
        const body: ImportRequest = await req.json();
        const { course, circleToken, spaceGroupId, geniallyUrls, imageAssignments } = body;

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

        // ── Pre-upload images ────────────────────────────────────────────────
        // signedIds maps placeholder index → signed_id for later HTML injection
        const signedIds: Record<number, string> = {};

        if (imageAssignments && Object.keys(imageAssignments).length > 0) {
          for (const [idxStr, dataUrl] of Object.entries(imageAssignments)) {
            const idx = parseInt(idxStr, 10);
            const parsed = parseDataUrl(dataUrl);
            if (!parsed) continue;

            const { buffer, contentType } = parsed;
            const checksum = md5Base64(buffer);
            const ext = contentType.split("/")[1] ?? "bin";
            const filename = `image-${idx}.${ext}`;

            try {
              const upload = await createDirectUpload(
                circleToken,
                filename,
                buffer.length,
                contentType,
                checksum
              );
              await uploadFile(upload.direct_upload.url, upload.direct_upload.headers, buffer);
              signedIds[idx] = upload.signed_id;
            } catch (imgErr) {
              // Non-fatal: keep as placeholder if upload fails
              console.warn(`Image upload failed for [IMAGE ${idx}]:`, imgErr);
            }
          }
        }

        // ── Create sections and lessons ──────────────────────────────────────
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

            let bodyHtml = buildHtmlWithGenially(lesson.blocks, geniallyUrls);

            // Inject CDN note after each uploaded image placeholder
            // Placeholder HTML: <p>📷 <strong>[IMAGE N: description]</strong></p>
            bodyHtml = bodyHtml.replace(
              /(<p>📷 <strong>\[IMAGE (\d+): [^\]]*\]<\/strong><\/p>)/g,
              (match, _full, idxStr) => {
                const signedId = signedIds[parseInt(idxStr, 10)];
                if (!signedId) return match;
                return (
                  match +
                  `\n<p><em>📸 Image uploaded to Circle CDN. signed_id: ${signedId} — insert via Circle editor's image tool.</em></p>`
                );
              }
            );

            // Record uploaded images for the log (per-lesson)
            for (const block of lesson.blocks) {
              if (block.type === "image_placeholder" && signedIds[block.index]) {
                partial.uploadedImages!.push({
                  lessonName: lesson.name,
                  placeholderIndex: block.index,
                  description: block.description,
                  signedId: signedIds[block.index],
                });
              }
            }

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
