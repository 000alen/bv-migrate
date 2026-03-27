"use client";

import { useReducer, useEffect, useRef, Component, ReactNode } from "react";
import { Settings } from "lucide-react";

// ─── Error Boundary ───────────────────────────────────────────────────────────

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="font-semibold text-red-600 text-lg">Something went wrong.</p>
          <p className="mt-1 text-sm text-gray-500">
            {(this.state.error as Error).message}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-4 text-sm underline text-gray-600 hover:text-black"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import type { CourseStructure } from "@/lib/schema";
import type { ContentType, ImportLog, ImportProgressEvent, ZipImage } from "@/lib/types";
import { BobMessage } from "@/components/bob-message";
import { UserBubble } from "@/components/user-bubble";
import { SettingsDrawer } from "@/components/settings-drawer";
import { ContentTypeStep } from "@/components/steps/content-type-step";
import { NumberStep } from "@/components/steps/number-step";
import { PdfUploadStep } from "@/components/steps/pdf-upload-step";
import { ExtractionStep } from "@/components/steps/extraction-step";
import { ImageUploadStep } from "@/components/steps/image-upload-step";
import { ImageMatchingStep } from "@/components/steps/image-matching-step";
import { GeniallyStep } from "@/components/steps/genially-step";
import { ImportStep } from "@/components/steps/import-step";
import { ContentPreview } from "@/components/content-preview";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase =
  | "greeting"
  | "content-type"
  | "number-selection"
  | "pdf-upload"
  | "extracting"
  | "review-extraction"
  | "image-upload"
  | "image-matching"
  | "genially-links"
  | "importing"
  | "complete";

interface AppState {
  phase: Phase;
  visited: Phase[];
  settingsOpen: boolean;
  keyNudge: string | null;

  circleToken: string;
  anthropicKey: string;
  spaceGroupId: string;

  contentType: ContentType | null;
  contentNumber: number | null;

  pdfFile: File | null;
  pdfFileName: string | null;
  extractionTrigger: number;
  extractionStatus: string;
  extractionError: string | null;
  courseStructure: CourseStructure | null;
  reviewConfirmed: boolean;

  zipImages: ZipImage[];
  imageAssignments: Record<number, string>;

  imageMatchingConfirmed: boolean;

  geniallyUrls: Record<string, string>;
  geniallyConfirmed: boolean;

  importTrigger: number;
  importProgress: ImportProgressEvent[];
  importStatus: string;
  importLog: ImportLog | null;
  importError: string | null;
  importPartial: ImportLog | null;
}

type Action =
  | { type: "INIT"; circleToken: string; anthropicKey: string; spaceGroupId: string }
  | { type: "OPEN_SETTINGS" }
  | { type: "CLOSE_SETTINGS" }
  | { type: "SET_CIRCLE_TOKEN"; value: string }
  | { type: "SET_ANTHROPIC_KEY"; value: string }
  | { type: "SET_SPACE_GROUP_ID"; value: string }
  | { type: "SHOW_KEY_NUDGE"; message: string }
  | { type: "ADVANCE_FROM_GREETING" }
  | { type: "SELECT_CONTENT_TYPE"; contentType: ContentType }
  | { type: "SELECT_NUMBER"; number: number }
  | { type: "SET_PDF_FILE"; file: File; fileName: string }
  | { type: "EXTRACTION_STATUS"; message: string }
  | { type: "EXTRACTION_COMPLETE"; course: CourseStructure }
  | { type: "EXTRACTION_ERROR"; error: string }
  | { type: "RETRY_EXTRACTION" }
  | { type: "UPDATE_COURSE"; course: CourseStructure }
  | { type: "CONFIRM_EXTRACTION" }
  | { type: "SET_ZIP_IMAGES"; images: ZipImage[] }
  | { type: "UPDATE_IMAGE_ASSIGNMENTS"; assignments: Record<number, string> }
  | { type: "CONFIRM_IMAGE_MATCHING" }
  | { type: "UPDATE_GENIALLY_URLS"; urls: Record<string, string> }
  | { type: "CONFIRM_GENIALLY" }
  | { type: "TRIGGER_IMPORT" }
  | { type: "IMPORT_PROGRESS"; event: ImportProgressEvent }
  | { type: "IMPORT_STATUS"; message: string }
  | { type: "IMPORT_COMPLETE"; log: ImportLog }
  | { type: "IMPORT_ERROR"; error: string; partial?: ImportLog | null }
  | { type: "RETRY_IMPORT" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasImages(course: CourseStructure) {
  return course.sections.some((s) =>
    s.lessons.some((l) => l.blocks.some((b) => b.type === "image_placeholder"))
  );
}

function hasGenially(course: CourseStructure) {
  return course.sections.some((s) =>
    s.lessons.some((l) => l.blocks.some((b) => b.type === "genially_placeholder"))
  );
}

function visit(state: AppState, phase: Phase): Pick<AppState, "phase" | "visited"> {
  return {
    phase,
    visited: state.visited.includes(phase) ? state.visited : [...state.visited, phase],
  };
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

const initial: AppState = {
  phase: "greeting",
  visited: ["greeting"],
  settingsOpen: false,
  keyNudge: null,
  circleToken: "",
  anthropicKey: "",
  spaceGroupId: "",
  contentType: null,
  contentNumber: null,
  pdfFile: null,
  pdfFileName: null,
  extractionTrigger: 0,
  extractionStatus: "",
  extractionError: null,
  courseStructure: null,
  reviewConfirmed: false,
  zipImages: [],
  imageAssignments: {},
  imageMatchingConfirmed: false,
  geniallyUrls: {},
  geniallyConfirmed: false,
  importTrigger: 0,
  importProgress: [],
  importStatus: "",
  importLog: null,
  importError: null,
  importPartial: null,
};

function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case "INIT":
      return { ...s, circleToken: a.circleToken, anthropicKey: a.anthropicKey, spaceGroupId: a.spaceGroupId };
    case "OPEN_SETTINGS":
      return { ...s, settingsOpen: true };
    case "CLOSE_SETTINGS":
      return { ...s, settingsOpen: false, keyNudge: null };
    case "SET_CIRCLE_TOKEN":
      return { ...s, circleToken: a.value };
    case "SET_ANTHROPIC_KEY":
      return { ...s, anthropicKey: a.value };
    case "SET_SPACE_GROUP_ID":
      return { ...s, spaceGroupId: a.value };
    case "SHOW_KEY_NUDGE":
      return { ...s, keyNudge: a.message };
    case "ADVANCE_FROM_GREETING":
      return { ...s, ...visit(s, "content-type") };
    case "SELECT_CONTENT_TYPE":
      return { ...s, contentType: a.contentType, keyNudge: null, ...visit(s, "number-selection") };
    case "SELECT_NUMBER":
      return { ...s, contentNumber: a.number, ...visit(s, "pdf-upload") };
    case "SET_PDF_FILE":
      return {
        ...s,
        pdfFile: a.file,
        pdfFileName: a.fileName,
        extractionTrigger: s.extractionTrigger + 1,
        extractionError: null,
        extractionStatus: "",
        ...visit(s, "extracting"),
      };
    case "EXTRACTION_STATUS":
      return { ...s, extractionStatus: a.message };
    case "EXTRACTION_COMPLETE":
      return { ...s, courseStructure: a.course, extractionError: null, ...visit(s, "review-extraction") };
    case "EXTRACTION_ERROR":
      return { ...s, extractionError: a.error };
    case "RETRY_EXTRACTION":
      return { ...s, extractionError: null, extractionStatus: "", extractionTrigger: s.extractionTrigger + 1 };
    case "UPDATE_COURSE":
      return { ...s, courseStructure: a.course };
    case "CONFIRM_EXTRACTION": {
      const c = s.courseStructure!;
      const next = hasImages(c) ? "image-upload" : hasGenially(c) ? "genially-links" : "importing";
      return { ...s, reviewConfirmed: true, ...visit(s, next) };
    }
    case "SET_ZIP_IMAGES":
      return { ...s, zipImages: a.images, ...visit(s, "image-matching") };
    case "UPDATE_IMAGE_ASSIGNMENTS":
      return { ...s, imageAssignments: a.assignments };
    case "CONFIRM_IMAGE_MATCHING": {
      const c = s.courseStructure!;
      const next = hasGenially(c) ? "genially-links" : "importing";
      return { ...s, imageMatchingConfirmed: true, ...visit(s, next) };
    }
    case "UPDATE_GENIALLY_URLS":
      return { ...s, geniallyUrls: a.urls };
    case "CONFIRM_GENIALLY":
      return { ...s, geniallyConfirmed: true, ...visit(s, "importing") };
    case "TRIGGER_IMPORT":
      return { ...s, importTrigger: s.importTrigger + 1, importProgress: [], importStatus: "", importError: null, importPartial: null };
    case "IMPORT_PROGRESS":
      return { ...s, importProgress: [...s.importProgress, a.event], importStatus: a.event.message };
    case "IMPORT_STATUS":
      return { ...s, importStatus: a.message };
    case "IMPORT_COMPLETE":
      return { ...s, importLog: a.log, importError: null, importPartial: null, ...visit(s, "complete") };
    case "IMPORT_ERROR":
      return { ...s, importError: a.error, importPartial: a.partial ?? null };
    case "RETRY_IMPORT":
      return { ...s, importError: null, importProgress: [], importStatus: "", importPartial: null, importTrigger: s.importTrigger + 1 };
    default:
      return s;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const [s, dispatch] = useReducer(reducer, initial);
  const endRef = useRef<HTMLDivElement>(null);

  // Load settings from localStorage
  useEffect(() => {
    dispatch({
      type: "INIT",
      circleToken: localStorage.getItem("bv_circle_token") ?? "",
      anthropicKey: localStorage.getItem("bv_anthropic_key") ?? "",
      spaceGroupId: localStorage.getItem("bv_space_group_id") ?? "",
    });
  }, []);

  // Auto-advance from greeting
  useEffect(() => {
    if (s.phase !== "greeting") return;
    const t = setTimeout(() => dispatch({ type: "ADVANCE_FROM_GREETING" }), 600);
    return () => clearTimeout(t);
  }, [s.phase]);

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [s.visited.length, s.extractionStatus, s.importStatus, s.importLog]);

  // Extraction side-effect
  useEffect(() => {
    if (s.extractionTrigger === 0) return;
    if (!s.pdfFile || !s.anthropicKey) return;

    const msgs = [
      "Reading your PDF…",
      "Identifying course structure…",
      "Extracting lesson content…",
      "Processing interactive elements…",
    ];
    const timers = [800, 3500, 7000, 12000].map((delay, i) =>
      setTimeout(() => dispatch({ type: "EXTRACTION_STATUS", message: msgs[i] }), delay)
    );

    const fd = new FormData();
    fd.append("pdf", s.pdfFile);

    fetch("/api/extract", { method: "POST", headers: { "x-anthropic-key": s.anthropicKey }, body: fd })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Extraction failed" })) as { error?: string };
          throw new Error(err.error ?? "Extraction failed");
        }
        return res.json() as Promise<CourseStructure>;
      })
      .then((data) => {
        timers.forEach(clearTimeout);
        dispatch({ type: "EXTRACTION_COMPLETE", course: data });
      })
      .catch((err: Error) => {
        timers.forEach(clearTimeout);
        dispatch({ type: "EXTRACTION_ERROR", error: err.message });
      });

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.extractionTrigger]);

  // Import side-effect
  useEffect(() => {
    if (s.importTrigger === 0) return;
    if (!s.courseStructure || !s.circleToken) return;
    const spaceGroupId = parseInt(s.spaceGroupId, 10);
    if (isNaN(spaceGroupId)) return;

    fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        course: s.courseStructure,
        circleToken: s.circleToken,
        spaceGroupId,
        geniallyUrls: s.geniallyUrls,
        imageAssignments: s.imageAssignments,
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Import request failed");
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response stream");
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
              const data = JSON.parse(line.slice(6)) as { type: string; message?: string; step?: number; total?: number; log?: ImportLog; partial?: ImportLog | null };
              if (data.type === "progress") {
                dispatch({ type: "IMPORT_PROGRESS", event: data as ImportProgressEvent });
              } else if (data.type === "complete" && data.log) {
                dispatch({ type: "IMPORT_COMPLETE", log: data.log });
              } else if (data.type === "error") {
                dispatch({ type: "IMPORT_ERROR", error: data.message ?? "Unknown error", partial: data.partial });
              }
            } catch (e) { console.warn("SSE parse error:", e); }
          }
        }
      })
      .catch((err: Error) => dispatch({ type: "IMPORT_ERROR", error: err.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.importTrigger]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const seen = (p: Phase) => s.visited.includes(p);
  const ct = s.contentType ? s.contentType[0].toUpperCase() + s.contentType.slice(1) : "";
  const maxN = s.contentType === "module" ? 9 : 4;

  function requireKeys(then: () => void) {
    if (!s.anthropicKey) {
      dispatch({ type: "SHOW_KEY_NUDGE", message: "Hold on — you need to set up your API keys first! Click the ⚙️ in the top right." });
      dispatch({ type: "OPEN_SETTINGS" });
      return;
    }
    then();
  }

  function requireImportKeys(then: () => void) {
    if (!s.circleToken || !s.spaceGroupId) {
      dispatch({ type: "SHOW_KEY_NUDGE", message: "Hold on — you need your Circle API token and Space Group ID first! Click the ⚙️ in the top right." });
      dispatch({ type: "OPEN_SETTINGS" });
      return;
    }
    then();
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-lg tracking-tight">Content Constructors</span>
          <button
            onClick={() => dispatch({ type: "OPEN_SETTINGS" })}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Conversation */}
      <ErrorBoundary>
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-4 pb-24">
        {/* Greeting — always shown */}
        <BobMessage
          message="Hey! I'm Bob the Builder 👷 Welcome to Content Constructors!"
          subtext="I'll help you migrate your beVisioneers course content to Circle."
        />

        {/* API key nudge */}
        {s.keyNudge && <BobMessage message={s.keyNudge} />}

        {/* Step 1: Content type */}
        {seen("content-type") && (
          <>
            <BobMessage message="So tell me, what are we migrating today?" />
            {s.contentType ? (
              <UserBubble>{ct}</UserBubble>
            ) : (
              <ContentTypeStep
                onSelect={(ct) =>
                  requireKeys(() => dispatch({ type: "SELECT_CONTENT_TYPE", contentType: ct }))
                }
              />
            )}
          </>
        )}

        {/* Step 2: Number */}
        {seen("number-selection") && (
          <>
            <BobMessage message={`Which ${s.contentType} number?`} />
            {s.contentNumber !== null ? (
              <UserBubble>{`${ct} ${s.contentNumber}`}</UserBubble>
            ) : (
              <NumberStep max={maxN} onSelect={(n) => dispatch({ type: "SELECT_NUMBER", number: n })} />
            )}
          </>
        )}

        {/* Step 3: PDF upload */}
        {seen("pdf-upload") && (
          <>
            <BobMessage
              message={`Awesome! ${ct} ${s.contentNumber} it is. Drop your script PDF here 📄`}
            />
            {s.pdfFileName ? (
              <UserBubble>📄 {s.pdfFileName}</UserBubble>
            ) : (
              <PdfUploadStep
                onFile={(file) =>
                  requireKeys(() => dispatch({ type: "SET_PDF_FILE", file, fileName: file.name }))
                }
              />
            )}
          </>
        )}

        {/* Step 4: Extracting */}
        {seen("extracting") && !s.courseStructure && (
          <>
            <BobMessage message="Let me read through this… 📖" />
            <ExtractionStep
              status={s.extractionStatus}
              error={s.extractionError}
              onRetry={() => dispatch({ type: "RETRY_EXTRACTION" })}
            />
          </>
        )}

        {/* Step 5: Review extraction */}
        {seen("review-extraction") && s.courseStructure && (
          <>
            <BobMessage message="Done! Here's what I found:" />
            {!s.reviewConfirmed ? (
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm animate-fade-in">
                <ContentPreview
                  course={s.courseStructure}
                  onChange={(c) => dispatch({ type: "UPDATE_COURSE", course: c })}
                  onNext={() => dispatch({ type: "CONFIRM_EXTRACTION" })}
                />
              </div>
            ) : (
              <UserBubble>Looks good! ✓</UserBubble>
            )}
          </>
        )}

        {/* Step 6: Image ZIP upload */}
        {seen("image-upload") && (
          <>
            <BobMessage message="Now I need the images. Drop your ZIP folder here 📁" />
            {seen("image-matching") ? (
              <UserBubble>📁 Found {s.zipImages.length} image{s.zipImages.length !== 1 ? "s" : ""} in the ZIP</UserBubble>
            ) : (
              <ImageUploadStep
                onImages={(imgs) => dispatch({ type: "SET_ZIP_IMAGES", images: imgs })}
              />
            )}
          </>
        )}

        {/* Step 7: Image matching */}
        {seen("image-matching") && s.courseStructure && (
          <>
            <BobMessage message="Let me match these to your placeholders…" />
            {s.imageMatchingConfirmed ? (
              <UserBubble>All images matched ✓</UserBubble>
            ) : (
              <ImageMatchingStep
                course={s.courseStructure}
                zipImages={s.zipImages}
                assignments={s.imageAssignments}
                onAssignmentsChange={(a) => dispatch({ type: "UPDATE_IMAGE_ASSIGNMENTS", assignments: a })}
                onConfirm={() => dispatch({ type: "CONFIRM_IMAGE_MATCHING" })}
              />
            )}
          </>
        )}

        {/* Step 8: Genially links */}
        {seen("genially-links") && s.courseStructure && (
          <>
            <BobMessage message="Almost there! Here are the interactive elements that need Genially embeds:" />
            {s.geniallyConfirmed ? (
              <UserBubble>Genially URLs added ✓</UserBubble>
            ) : (
              <GeniallyStep
                course={s.courseStructure}
                urls={s.geniallyUrls}
                onUrlsChange={(u) => dispatch({ type: "UPDATE_GENIALLY_URLS", urls: u })}
                onConfirm={() => dispatch({ type: "CONFIRM_GENIALLY" })}
              />
            )}
          </>
        )}

        {/* Step 9: Import */}
        {seen("importing") && s.courseStructure && (() => {
          const totalLessons = s.courseStructure.sections.reduce((n, sec) => n + sec.lessons.length, 0);
          return (
            <>
              <BobMessage
                message={`Let's build this! 🏗️ I'll create "${s.courseStructure.name}" with ${s.courseStructure.sections.length} section${s.courseStructure.sections.length !== 1 ? "s" : ""} and ${totalLessons} lesson${totalLessons !== 1 ? "s" : ""} — all set to draft.`}
                subtext="⚠️ Images will stay as placeholders ([IMAGE N: …]) in the lesson HTML — replace them manually in Circle after import."
              />
              <ImportStep
                triggered={s.importTrigger > 0}
                progress={s.importProgress}
                status={s.importStatus}
                log={s.importLog}
                error={s.importError}
                onTrigger={() =>
                  requireImportKeys(() => dispatch({ type: "TRIGGER_IMPORT" }))
                }
                onRetry={() => dispatch({ type: "RETRY_IMPORT" })}
              />
            </>
          );
        })()}

        {/* Step 10: Complete */}
        {seen("complete") && (
          <BobMessage message="All done! 🎉 Your course is live on Circle (as drafts)." />
        )}

        <div ref={endRef} />
      </main>
      </ErrorBoundary>

      {/* Settings drawer */}
      <SettingsDrawer
        open={s.settingsOpen}
        circleToken={s.circleToken}
        anthropicKey={s.anthropicKey}
        spaceGroupId={s.spaceGroupId}
        onClose={() => dispatch({ type: "CLOSE_SETTINGS" })}
        onCircleToken={(v) => {
          dispatch({ type: "SET_CIRCLE_TOKEN", value: v });
          localStorage.setItem("bv_circle_token", v);
        }}
        onAnthropicKey={(v) => {
          dispatch({ type: "SET_ANTHROPIC_KEY", value: v });
          localStorage.setItem("bv_anthropic_key", v);
        }}
        onSpaceGroupId={(v) => {
          dispatch({ type: "SET_SPACE_GROUP_ID", value: v });
          localStorage.setItem("bv_space_group_id", v);
        }}
      />
    </div>
  );
}
