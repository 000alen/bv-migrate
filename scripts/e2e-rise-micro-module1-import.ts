import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";

/** Load `.env.local` / `.env` so keys work without exporting in shell. */
function loadLocalEnv(): void {
  for (const name of [".env.local", ".env"]) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, "utf8");
    for (const line of text.split("\n")) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      const i = s.indexOf("=");
      if (i <= 0) continue;
      const key = s.slice(0, i).trim();
      let val = s.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

loadLocalEnv();

/**
 * E2E: Articulate Rise ZIP → parse → Circle import (in-process API routes).
 *
 *   CIRCLE_TOKEN=... SPACE_GROUP_ID=... pnpm e2e:rise:micro1
 *
 * Optional:
 *   E2E_RISE_ZIP=path/to.zip  — default: ./Micro_Module_1_CPS.zip
 *   E2E_SKIP_CLEANUP=1        — keep the created Circle space
 */

import { NextRequest } from "next/server";
import { POST as extractRisePost } from "../app/api/extract-rise/route";
import { POST as importPost } from "../app/api/import/route";
import type { CourseStructure } from "../lib/schema";
import type { ImportLog } from "../lib/types";
import { BASE_URL, authHeaders } from "../lib/circle";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env: ${name}`);
    process.exit(1);
  }
  return v;
}

async function consumeSSELive(
  response: Response,
  label: string
): Promise<Array<Record<string, unknown>>> {
  const events: Array<Record<string, unknown>> = [];
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Response has no body");

  const dec = new TextDecoder();
  let buf = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
        events.push(data);
        const t = data.type;
        if (t === "progress") {
          const stepInfo =
            typeof data.step === "number" && typeof data.total === "number"
              ? ` (step ${data.step}/${data.total})`
              : "";
          console.log(`[${label}] progress`, data.message ?? "", stepInfo);
        } else if (t === "ping") {
          console.log(`[${label}] ping`);
        } else if (t === "complete") {
          console.log(`[${label}] complete`);
        } else if (t === "error") {
          console.error(`[${label}] error`, data.message, data.details ?? "");
        } else {
          console.log(`[${label}]`, data);
        }
      } catch {
        // ignore malformed lines
      }
    }
  }

  return events;
}

function findEvent(
  events: Array<Record<string, unknown>>,
  type: string
): Record<string, unknown> | undefined {
  return events.find((e) => e.type === type);
}

async function main(): Promise<void> {
  const tStart = Date.now();
  const circleToken = requireEnv("CIRCLE_TOKEN");
  const spaceGroupId = parseInt(requireEnv("SPACE_GROUP_ID"), 10);

  const zipRel = process.env.E2E_RISE_ZIP ?? "Micro_Module_1_CPS.zip";
  const zipPath = join(process.cwd(), zipRel);
  console.log(`[e2e] Rise ZIP: ${zipPath}`);
  if (!existsSync(zipPath)) {
    console.error(`[e2e] ZIP not found: ${zipPath}`);
    process.exit(1);
  }

  const buf = readFileSync(zipPath);
  const zipFile = new File([buf], zipRel.split("/").pop() ?? "course.zip", {
    type: "application/zip",
  });

  console.log("\n--- EXTRACT (Rise) ---\n");
  const fd = new FormData();
  fd.append("zip", zipFile);

  const extractReq = new NextRequest("http://localhost/api/extract-rise", {
    method: "POST",
    body: fd,
  });

  const extractRes = await extractRisePost(extractReq);
  if (extractRes.status !== 200) {
    console.error("[e2e] extract-rise HTTP", extractRes.status);
    process.exit(1);
  }

  const extractEvents = await consumeSSELive(extractRes, "extract-rise");
  const extractErr = findEvent(extractEvents, "error");
  if (extractErr) {
    console.error("[e2e] extract-rise failed", JSON.stringify(extractErr, null, 2));
    process.exit(1);
  }

  const complete = findEvent(extractEvents, "complete");
  if (!complete?.course) {
    console.error("[e2e] no complete event with course");
    process.exit(1);
  }

  const warnings = complete.warnings;
  if (Array.isArray(warnings) && warnings.length > 0) {
    console.log("[e2e] Rise parse warnings:", warnings);
  }

  const course = complete.course as CourseStructure;
  const imageData = complete.imageData as
    | Record<number, { filename: string; dataUrl: string }>
    | undefined;

  const uniqueCourse: CourseStructure = {
    ...course,
    name: `[E2E Rise] ${course.name}`,
    slug: `${course.slug}-e2e-rise-${Date.now()}`,
  };

  console.log("\n--- IMPORT ---\n");
  const importReq = new NextRequest("http://localhost/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      course: uniqueCourse,
      circleToken,
      spaceGroupId,
      geniallyUrls: {},
      imageData: imageData ?? {},
    }),
  });

  const importRes = await importPost(importReq);
  if (importRes.status !== 200) {
    console.error("[e2e] import HTTP", importRes.status);
    process.exit(1);
  }

  const importEvents = await consumeSSELive(importRes, "import");
  const importErr = findEvent(importEvents, "error");
  if (importErr) {
    console.error("[e2e] import failed", JSON.stringify(importErr, null, 2));
    const partial = importErr.partial as ImportLog | null | undefined;
    if (partial) {
      console.error("[e2e] partial log", JSON.stringify(partial, null, 2));
    }
    process.exit(1);
  }

  const importDone = findEvent(importEvents, "complete");
  const log = importDone?.log as ImportLog | undefined;
  if (!log) {
    console.error("[e2e] no import complete");
    process.exit(1);
  }

  console.log("\n--- DONE ---\n");
  console.log(JSON.stringify(log, null, 2));
  console.log(`\n[e2e] total wall time: ${((Date.now() - tStart) / 1000).toFixed(1)}s`);

  const skipCleanup = process.env.E2E_SKIP_CLEANUP === "1";
  if (!skipCleanup && log.courseId) {
    console.log(`\n[e2e] deleting space ${log.courseId} (set E2E_SKIP_CLEANUP=1 to keep)`);
    const res = await fetch(`${BASE_URL}/spaces/${log.courseId}`, {
      method: "DELETE",
      headers: authHeaders(circleToken, "DELETE"),
    });
    if (!res.ok && res.status !== 404) {
      console.warn(`[e2e] DELETE failed ${res.status}`);
    } else {
      console.log("[e2e] space deleted");
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
