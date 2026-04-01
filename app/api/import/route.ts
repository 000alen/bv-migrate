import { NextRequest } from "next/server";
import type { ImportLog } from "@/lib/types";
import { createSSEStream, sseResponse } from "@/lib/sse";
import { CourseStructure } from "@/lib/schema";
import { buildHtmlWithGenially } from "@/lib/html-builder";
import { md5Base64, parseDataUrl } from "@/lib/server-utils";
import {
  createCourse,
  createSection,
  createLesson,
  createDirectUpload,
  uploadFile,
} from "@/lib/circle";

interface ImageDatum {
  filename: string;
  dataUrl: string;
}

interface ImportRequest {
  course: CourseStructure;
  circleToken: string;
  spaceGroupId: number;
  geniallyUrls: Record<string, string>;
  /** placeholder index → image name (not used for upload, kept for compat) */
  imageAssignments?: Record<number, string>;
  /** placeholder index → { filename, base64 dataUrl } — used for CDN upload */
  imageData?: Record<number, ImageDatum>;
}

export async function POST(req: NextRequest) {
  const { stream, send, close } = createSSEStream();

  void (async () => {
    const t0 = Date.now();
    const log = (msg: string, extra?: Record<string, unknown>) => {
      console.log(`[import] ${msg}`, { ms: Date.now() - t0, ...extra });
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
      const { course, circleToken, spaceGroupId, geniallyUrls, imageData } = body;

      if (!course || !circleToken || !spaceGroupId) {
        log("request_rejected", { reason: "missing_fields" });
        send({
          type: "error",
          message: "Missing required fields: course, circleToken, spaceGroupId",
          partial: null,
        });
        return;
      }

      partial.courseName = course.name;

      const totalLessons = course.sections.reduce(
        (sum, s) => sum + s.lessons.length,
        0
      );
      const totalSections = course.sections.length;
      const total = 1 + totalSections + totalLessons;
      let step = 0;

      log("start", {
        courseName: course.name,
        slug: course.slug,
        spaceGroupId,
        sections: totalSections,
        lessons: totalLessons,
        stepsTotal: total,
        geniallyKeys: Object.keys(geniallyUrls ?? {}).length,
        imageDataKeys: imageData ? Object.keys(imageData).length : 0,
      });

      send({
        type: "progress",
        message: `Creating course "${course.name}"...`,
        step,
        total,
      });

      const courseStart = Date.now();
      const createdCourse = await createCourse(
        circleToken,
        course.name,
        course.slug,
        spaceGroupId
      );
      partial.courseId = createdCourse.id;
      step++;
      log("course_created", {
        courseId: createdCourse.id,
        ms: Date.now() - courseStart,
      });

      const signedIds: Record<number, string> = {};

      if (imageData && Object.keys(imageData).length > 0) {
        log("image_uploads_start", { count: Object.keys(imageData).length });
        for (const [idxStr, datum] of Object.entries(imageData)) {
          const idx = parseInt(idxStr, 10);
          const parsed = parseDataUrl(datum.dataUrl);
          if (!parsed) {
            log("image_upload_skip_bad_dataurl", { idx });
            continue;
          }

          const { buffer, contentType } = parsed;
          const checksum = md5Base64(buffer);

          try {
            const upStart = Date.now();
            const upload = await createDirectUpload(
              circleToken,
              datum.filename,
              buffer.length,
              contentType,
              checksum
            );
            await uploadFile(
              upload.direct_upload.url,
              upload.direct_upload.headers,
              buffer
            );
            signedIds[idx] = upload.signed_id;
            log("image_upload_ok", {
              idx,
              filename: datum.filename,
              bytes: buffer.length,
              ms: Date.now() - upStart,
            });
          } catch (imgErr) {
            console.warn(`[import] image_upload_failed idx=${idx}`, imgErr);
            log("image_upload_failed", {
              idx,
              error: imgErr instanceof Error ? imgErr.message : String(imgErr),
            });
          }
        }
        log("image_uploads_done", { signedCount: Object.keys(signedIds).length });
      }

      for (const section of course.sections) {
        send({
          type: "progress",
          message: `Creating section "${section.name}"...`,
          step,
          total,
        });

        const secStart = Date.now();
        const createdSection = await createSection(
          circleToken,
          createdCourse.id,
          section.name
        );
        step++;
        log("section_created", {
          sectionId: createdSection.id,
          name: section.name,
          ms: Date.now() - secStart,
        });

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

          bodyHtml = bodyHtml.replace(
            /(<p>📷 <strong>\[IMAGE (\d+): .*?\]<\/strong><\/p>)/g,
            (match, _full, idxStr) => {
              const signedId = signedIds[parseInt(idxStr, 10)];
              if (!signedId) return match;
              return (
                match +
                `\n<p><em>📸 Image uploaded to Circle CDN. signed_id: ${signedId} — insert via Circle editor's image tool.</em></p>`
              );
            }
          );

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

          const lessonStart = Date.now();
          const createdLesson = await createLesson(
            circleToken,
            createdSection.id,
            lesson.name,
            bodyHtml
          );
          log("lesson_created", {
            lessonId: createdLesson.id,
            lessonName: lesson.name,
            sectionId: createdSection.id,
            bodyHtmlChars: bodyHtml.length,
            ms: Date.now() - lessonStart,
          });
          step++;

          sectionLog.lessons.push({
            id: createdLesson.id,
            name: lesson.name,
          });
        }
      }

      log("complete", {
        courseId: partial.courseId,
        sections: partial.sections.length,
        lessons: partial.sections.reduce((n, s) => n + s.lessons.length, 0),
        totalMs: Date.now() - t0,
      });
      send({ type: "complete", log: partial });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[import] fatal_error", {
        message,
        stack: error instanceof Error ? error.stack : undefined,
        partialCourseId: partial.courseId,
        partialSections: partial.sections.length,
      });
      send({
        type: "error",
        message,
        partial: partial.courseId !== -1 ? partial : null,
      });
    } finally {
      close();
    }
  })();

  return sseResponse(stream);
}
