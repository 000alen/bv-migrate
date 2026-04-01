import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

/** Load `.env.local` / `.env` so `pnpm e2e:module2` picks up keys without exporting in shell. */
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
 * Run from repo root (logs stream as SSE events arrive).
 *
 * Default: local PDF text → Cerebras JSON (`CEREBRAS_API_KEY`).
 *
 *   CEREBRAS_API_KEY=... CIRCLE_TOKEN=... SPACE_GROUP_ID=... pnpm e2e:module2
 *
 * Anthropic instead (Claude; optional native PDF):
 *   E2E_LLM=anthropic ANTHROPIC_KEY=sk-ant-... ... pnpm e2e:module2
 *
 * Optional:
 *   E2E_SKIP_CLEANUP=1   — keep the created Circle space
 *   E2E_PDF=path/to.pdf  — default: ./Module 2 Script.pdf
 *   E2E_NATIVE_PDF=1     — only with E2E_LLM=anthropic (sends PDF bytes to Claude)
 *   BV_CEREBRAS_MODEL    — overrides Cerebras model (x-model)
 */

import { join } from "path";
import { NextRequest } from "next/server";
import { POST as extractPost } from "../app/api/extract/route";
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

/** Read SSE stream and log each event immediately; return all events. */
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

  const useNativePdf = process.env.E2E_NATIVE_PDF === "1";
  const useAnthropic =
    process.env.E2E_LLM === "anthropic" ||
    process.env.BV_EXTRACTION_LLM === "anthropic";
  const useCerebras = !useAnthropic;

  if (useNativePdf && useCerebras) {
    console.error(
      "[e2e] E2E_NATIVE_PDF requires Anthropic. Run: E2E_LLM=anthropic ANTHROPIC_KEY=... E2E_NATIVE_PDF=1 ..."
    );
    process.exit(1);
  }

  const pdfRel = process.env.E2E_PDF ?? "Module 2 Script.pdf";
  const pdfPath = join(process.cwd(), pdfRel);
  console.log(`[e2e] PDF: ${pdfPath}`);
  if (useCerebras) {
    console.log(
      "[e2e] extract: text-first pdf-parse → Cerebras (set BV_CEREBRAS_MODEL or x-model via env BV_CEREBRAS_MODEL)"
    );
  } else {
    console.log(
      `[e2e] extract mode: ${useNativePdf ? "native-pdf (Claude reads PDF bytes)" : "text-first (pdf-parse → Claude)"}`
    );
  }
  const buf = readFileSync(pdfPath);
  const file = new File([buf], pdfRel.split("/").pop() ?? "script.pdf", {
    type: "application/pdf",
  });

  console.log("\n--- EXTRACT ---\n");
  const fd = new FormData();
  fd.append("pdf", file);

  let extractHeaders: Record<string, string>;
  if (useCerebras) {
    const cerebrasKey = requireEnv("CEREBRAS_API_KEY");
    extractHeaders = {
      "x-llm-provider": "cerebras",
      "x-cerebras-key": cerebrasKey,
    };
    const m = process.env.BV_CEREBRAS_MODEL?.trim();
    if (m) extractHeaders["x-model"] = m;
  } else {
    extractHeaders = {
      "x-llm-provider": "anthropic",
      "x-anthropic-key": requireEnv("ANTHROPIC_KEY"),
    };
    if (useNativePdf) {
      extractHeaders["x-extract-mode"] = "native-pdf";
    }
  }
  const extractReq = new NextRequest("http://localhost/api/extract", {
    method: "POST",
    headers: extractHeaders,
    body: fd,
  });

  const extractRes = await extractPost(extractReq);
  if (extractRes.status !== 200) {
    console.error("[e2e] extract HTTP", extractRes.status);
    process.exit(1);
  }

  const extractEvents = await consumeSSELive(extractRes, "extract");
  const extractErr = findEvent(extractEvents, "error");
  if (extractErr) {
    console.error("[e2e] extract failed", JSON.stringify(extractErr, null, 2));
    process.exit(1);
  }

  const complete = findEvent(extractEvents, "complete");
  if (!complete?.course) {
    console.error("[e2e] no complete event with course");
    process.exit(1);
  }

  const course = complete.course as CourseStructure;
  const uniqueCourse: CourseStructure = {
    ...course,
    name: `[E2E] ${course.name}`,
    slug: `${course.slug}-e2e-${Date.now()}`,
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
