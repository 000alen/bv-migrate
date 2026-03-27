import { NextRequest } from "next/server";
import { createSSEStream, sseResponse } from "@/lib/sse";
import {
  createCourse,
  createSection,
  createLesson,
  getCourseSections,
  getCourseLessons,
  getLessonDetail,
} from "@/lib/circle";

interface ConsolidateSource {
  spaceId: number;
  label: string; // e.g. "Module 1 — DREAM: Learn, Borrow, Adapt"
}

interface ConsolidateRequest {
  sources: ConsolidateSource[];
  combinedName: string;
  combinedSlug: string;
  circleToken: string;
  spaceGroupId: number;
}

export async function POST(req: NextRequest) {
  const { stream, send, close } = createSSEStream();

  void (async () => {
    try {
        const body: ConsolidateRequest = await req.json();
        const { sources, combinedName, combinedSlug, circleToken, spaceGroupId } = body;

        if (!sources?.length || !combinedName || !circleToken || !spaceGroupId) {
          send({ type: "error", message: "Missing required fields" });
          close();
          return;
        }

        send({ type: "progress", message: `Fetching content from ${sources.length} module(s)...`, step: 0, total: 1 });

        // Phase 1: Fetch all source data
        type SourceData = {
          label: string;
          sections: Array<{
            id: number;
            name: string;
            lessons: Array<{ id: number; name: string; body_html: string }>;
          }>;
        };
        const sourceData: SourceData[] = [];

        for (const source of sources) {
          send({ type: "progress", message: `Reading "${source.label}"...`, step: 0, total: 1 });
          const sections = await getCourseSections(circleToken, source.spaceId);
          const sectData: SourceData["sections"] = [];
          for (const sec of sections) {
            const lessons = await getCourseLessons(circleToken, sec.id);
            // Serialize lesson fetches to avoid rate limiting (Circle has 30K/month cap)
            const lessonDetails: Array<{ id: number; name: string; body_html: string }> = [];
            for (const l of lessons) {
              const detail = await getLessonDetail(circleToken, l.id);
              lessonDetails.push(detail);
            }
            sectData.push({ id: sec.id, name: sec.name, lessons: lessonDetails });
          }
          sourceData.push({ label: source.label, sections: sectData });
        }

        // Calculate total steps
        const totalSections = sourceData.reduce((n, s) => n + s.sections.length, 0);
        const totalLessons = sourceData.reduce(
          (n, s) => n + s.sections.reduce((m, sec) => m + sec.lessons.length, 0),
          0
        );
        const total = 1 + totalSections + totalLessons;
        let step = 0;

        // Phase 2: Create combined course
        send({ type: "progress", message: `Creating combined course "${combinedName}"...`, step, total });
        const createdCourse = await createCourse(circleToken, combinedName, combinedSlug, spaceGroupId);
        step++;

        const log = {
          courseId: createdCourse.id,
          courseName: combinedName,
          sections: [] as Array<{
            id: number;
            name: string;
            lessons: Array<{ id: number; name: string }>;
          }>,
        };

        // Phase 3: Create sections and lessons
        for (const src of sourceData) {
          for (const srcSection of src.sections) {
            const sectionName = `${src.label} — ${srcSection.name}`;
            send({ type: "progress", message: `Creating section "${sectionName}"...`, step, total });
            const createdSection = await createSection(circleToken, createdCourse.id, sectionName);
            step++;

            const sectionLog = { id: createdSection.id, name: sectionName, lessons: [] as Array<{ id: number; name: string }> };
            log.sections.push(sectionLog);

            for (const lesson of srcSection.lessons) {
              send({ type: "progress", message: `Creating lesson "${lesson.name}"...`, step, total });
              const createdLesson = await createLesson(
                circleToken,
                createdSection.id,
                lesson.name,
                lesson.body_html ?? ""
              );
              step++;
              sectionLog.lessons.push({ id: createdLesson.id, name: lesson.name });
            }
          }
        }

        send({ type: "complete", log });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        send({ type: "error", message });
      } finally {
        close();
      }
  })();

  return sseResponse(stream);
}
