"use client";

import * as React from "react";
import JSZip from "jszip";
import { CourseStructure } from "@/lib/schema";
import { ImportLog } from "@/app/api/import/route";
import { ProgressEvent } from "@/components/genially-linker";
import { ApiKeyForm } from "@/components/api-key-form";
import { ContentPreview } from "@/components/content-preview";
import { ImageMatcher } from "@/components/image-matcher";
import { GeniallyLinker } from "@/components/genially-linker";
import { ImportProgress } from "@/components/import-progress";
import { BobAvatar } from "@/components/bob-avatar";
import {
  Settings,
  X,
  Upload,
  FileText,
  AlertCircle,
  Loader2,
  FolderOpen,
} from "lucide-react";

type ContentType = "module" | "milestone" | "micromodule";
type Phase = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const MAX_NUMBERS: Record<ContentType, number> = {
  module: 9,
  milestone: 4,
  micromodule: 4,
};

const TYPE_LABELS: Record<ContentType, string> = {
  module: "Module",
  milestone: "Milestone",
  micromodule: "Micromodule",
};

interface ImageAssignment {
  file: File;
  dataUrl: string;
}

function collectImagePlaceholderIndices(course: CourseStructure): number[] {
  const indices: number[] = [];
  for (const section of course.sections) {
    for (const lesson of section.lessons) {
      for (const block of lesson.blocks) {
        if (block.type === "image_placeholder") {
          indices.push(block.index);
        }
      }
    }
  }
  return [...new Set(indices)].sort((a, b) => a - b);
}

function hasGeniallyPlaceholders(course: CourseStructure): boolean {
  for (const section of course.sections) {
    for (const lesson of section.lessons) {
      for (const block of lesson.blocks) {
        if (block.type === "genially_placeholder") return true;
      }
    }
  }
  return false;
}

// ─── Small chat primitives ───────────────────────────────────────────────────

function BobMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 mt-1">
        <BobAvatar size={44} />
      </div>
      <div
        className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm max-w-sm text-sm leading-relaxed"
        style={{ border: "1px solid rgba(0,0,0,0.08)" }}
      >
        {children}
      </div>
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div
        className="px-4 py-2 rounded-2xl rounded-tr-sm text-sm font-semibold"
        style={{ backgroundColor: "#CE99F2" }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HomePage() {
  const [phase, setPhase] = React.useState<Phase>(0);
  const [contentType, setContentType] = React.useState<ContentType | null>(null);
  const [contentNumber, setContentNumber] = React.useState<number | null>(null);
  const [courseStructure, setCourseStructure] =
    React.useState<CourseStructure | null>(null);
  const [imageAssignments, setImageAssignments] = React.useState<
    Record<number, ImageAssignment>
  >({});
  const [geniallyUrls, setGeniallyUrls] = React.useState<
    Record<string, string>
  >({});
  const [importLog, setImportLog] = React.useState<ImportLog | null>(null);
  const [importProgress, setImportProgress] = React.useState<ProgressEvent[]>(
    []
  );
  const [isImporting, setIsImporting] = React.useState(false);
  const [importError, setImportError] = React.useState<string | null>(null);
  const [isExtracting, setIsExtracting] = React.useState(false);
  const [extractError, setExtractError] = React.useState<string | null>(null);
  const [pdfFile, setPdfFile] = React.useState<File | null>(null);
  const [isDraggingPdf, setIsDraggingPdf] = React.useState(false);
  const [zipFile, setZipFile] = React.useState<File | null>(null);
  const [isDraggingZip, setIsDraggingZip] = React.useState(false);
  const [isProcessingZip, setIsProcessingZip] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [circleToken, setCircleToken] = React.useState("");
  const [anthropicKey, setAnthropicKey] = React.useState("");
  const [spaceGroupId, setSpaceGroupId] = React.useState("");

  const pdfInputRef = React.useRef<HTMLInputElement>(null);
  const zipInputRef = React.useRef<HTMLInputElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  // Load API creds from localStorage on mount
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setCircleToken(localStorage.getItem("bv_circle_token") ?? "");
      setAnthropicKey(localStorage.getItem("bv_anthropic_key") ?? "");
      setSpaceGroupId(localStorage.getItem("bv_space_group_id") ?? "");
    }
  }, []);

  // Auto-scroll to bottom as conversation grows
  React.useEffect(() => {
    setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      150
    );
  }, [phase, isExtracting, courseStructure, isImporting]);

  // ── Phase advance handlers ──────────────────────────────────────────────────

  function selectContentType(type: ContentType) {
    setContentType(type);
    setPhase(1);
  }

  function selectNumber(n: number) {
    setContentNumber(n);
    setPhase(2);
  }

  function handlePdfFile(f: File) {
    if (f.type === "application/pdf" || f.name.endsWith(".pdf")) {
      setPdfFile(f);
      setExtractError(null);
    }
  }

  async function handleExtract() {
    if (!pdfFile || !anthropicKey) return;
    setPhase(3);
    setIsExtracting(true);
    setExtractError(null);
    try {
      const formData = new FormData();
      formData.append("pdf", pdfFile);
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "x-anthropic-key": anthropicKey },
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const course: CourseStructure = await res.json();
      setCourseStructure(course);
      setPhase(4);
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : String(e));
      setPhase(2);
    } finally {
      setIsExtracting(false);
    }
  }

  // Called by ContentPreview's own "continue" button
  function confirmPreview() {
    if (!courseStructure) return;
    const hasImages = collectImagePlaceholderIndices(courseStructure).length > 0;
    setPhase(hasImages ? 5 : 7);
  }

  async function handleZipFile(f: File) {
    setZipFile(f);
    setIsProcessingZip(true);
    try {
      const zip = await JSZip.loadAsync(f);
      const imageEntries: Array<{ name: string; data: Blob }> = [];

      for (const [filename, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue;
        if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(filename)) continue;
        const blob = await entry.async("blob");
        const baseName = filename.split("/").pop() ?? filename;
        imageEntries.push({ name: baseName, data: blob });
      }

      imageEntries.sort((a, b) => a.name.localeCompare(b.name));

      if (courseStructure) {
        const indices = collectImagePlaceholderIndices(courseStructure);
        const assignments: Record<number, ImageAssignment> = {};

        for (let i = 0; i < indices.length; i++) {
          if (!imageEntries[i]) break;
          const { name, data } = imageEntries[i];
          const imgFile = new File([data], name, { type: "image/jpeg" });
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(data);
          });
          assignments[indices[i]] = { file: imgFile, dataUrl };
        }

        setImageAssignments(assignments);
      }

      setPhase(6);
    } catch {
      // If ZIP parsing fails, still advance so user sees image matcher
      setPhase(6);
    } finally {
      setIsProcessingZip(false);
    }
  }

  // Called by ImageMatcher's own "continue" button
  function confirmImages() {
    setPhase(7);
  }

  // Build data-URL map for the import API
  const imageDataUrls = React.useMemo(
    () =>
      Object.fromEntries(
        Object.entries(imageAssignments).map(([k, v]) => [k, v.dataUrl])
      ),
    [imageAssignments]
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#F5F6F1" }}>

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-40 border-b border-white/10"
        style={{ backgroundColor: "#000" }}
      >
        <div className="mx-auto max-w-2xl px-4 flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg tracking-tight text-white">
              Content Constructors
            </span>
            <span
              className="hidden sm:block text-xs px-2 py-0.5 rounded-full text-black font-semibold"
              style={{ backgroundColor: "#F9FB75" }}
            >
              by beVisioneers
            </span>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            title="API Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* ── Settings slide-over ── */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSettingsOpen(false)}
          />
          <div className="relative w-80 bg-white h-full shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-black/10">
              <h2 className="font-semibold">Settings</h2>
              <button
                onClick={() => setSettingsOpen(false)}
                className="p-1 rounded hover:bg-black/5 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <ApiKeyForm
                circleToken={circleToken}
                anthropicKey={anthropicKey}
                spaceGroupId={spaceGroupId}
                onCircleTokenChange={(v) => {
                  setCircleToken(v);
                  localStorage.setItem("bv_circle_token", v);
                }}
                onAnthropicKeyChange={(v) => {
                  setAnthropicKey(v);
                  localStorage.setItem("bv_anthropic_key", v);
                }}
                onSpaceGroupIdChange={(v) => {
                  setSpaceGroupId(v);
                  localStorage.setItem("bv_space_group_id", v);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Conversation area ── */}
      <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-8 space-y-5">

        {/* ════ PHASE 0: Greeting + content type picker ════ */}

        <BobMessage>Hey! I&apos;m Bob the Builder. 👷</BobMessage>

        <BobMessage>So tell me — what are we migrating today?</BobMessage>

        <div className="flex gap-3 justify-center flex-wrap py-2">
          {(["module", "milestone", "micromodule"] as ContentType[]).map(
            (type) => (
              <button
                key={type}
                onClick={() => phase === 0 && selectContentType(type)}
                disabled={phase > 0 && contentType !== type}
                className="px-6 py-3 rounded-full font-semibold text-sm border-2 transition-all"
                style={
                  contentType === type
                    ? {
                        borderColor: "#000",
                        backgroundColor: "#000",
                        color: "#fff",
                        transform: "scale(1.05)",
                      }
                    : phase > 0
                    ? {
                        borderColor: "rgba(0,0,0,0.1)",
                        color: "rgba(0,0,0,0.25)",
                        cursor: "default",
                      }
                    : {
                        borderColor: "rgba(0,0,0,0.2)",
                        color: "#000",
                        cursor: "pointer",
                      }
                }
              >
                {TYPE_LABELS[type]}
              </button>
            )
          )}
        </div>

        {/* ════ PHASE 1: Number picker ════ */}
        {phase >= 1 && contentType && (
          <>
            <UserBubble>{TYPE_LABELS[contentType]}</UserBubble>

            <BobMessage>
              Nice! Which {TYPE_LABELS[contentType].toLowerCase()} number?
            </BobMessage>

            <div className="flex gap-2 justify-center flex-wrap py-2">
              {Array.from(
                { length: MAX_NUMBERS[contentType] },
                (_, i) => i + 1
              ).map((n) => (
                <button
                  key={n}
                  onClick={() => phase === 1 && selectNumber(n)}
                  disabled={phase > 1 && contentNumber !== n}
                  className="w-12 h-12 rounded-xl font-bold text-lg border-2 transition-all"
                  style={
                    contentNumber === n
                      ? {
                          borderColor: "#000",
                          backgroundColor: "#000",
                          color: "#fff",
                        }
                      : phase > 1
                      ? {
                          borderColor: "rgba(0,0,0,0.1)",
                          color: "rgba(0,0,0,0.2)",
                          cursor: "default",
                        }
                      : {
                          borderColor: "rgba(0,0,0,0.2)",
                          cursor: "pointer",
                        }
                  }
                >
                  {n}
                </button>
              ))}
            </div>
          </>
        )}

        {/* ════ PHASE 2 + 3: PDF upload & extraction ════ */}
        {phase >= 2 && (
          <>
            <UserBubble>
              {TYPE_LABELS[contentType!]} {contentNumber}
            </UserBubble>

            {phase === 2 && (
              <>
                <BobMessage>
                  {pdfFile
                    ? `Got it — ready to read "${pdfFile.name}"`
                    : "Great! Now drag your script PDF here:"}
                </BobMessage>

                {/* PDF dropzone */}
                <div
                  className="rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all bg-white"
                  style={{
                    borderColor: isDraggingPdf
                      ? "#CE99F2"
                      : pdfFile
                      ? "rgba(0,0,0,0.2)"
                      : "rgba(0,0,0,0.15)",
                    backgroundColor: isDraggingPdf ? "#faf5ff" : "#fff",
                  }}
                  onClick={() => pdfInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingPdf(true);
                  }}
                  onDragLeave={() => setIsDraggingPdf(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingPdf(false);
                    const f = e.dataTransfer.files[0];
                    if (f) handlePdfFile(f);
                  }}
                >
                  {pdfFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="h-8 w-8" style={{ color: "#CE99F2" }} />
                      <div className="text-left">
                        <p className="font-semibold">{pdfFile.name}</p>
                        <p className="text-sm" style={{ color: "rgba(0,0,0,0.5)" }}>
                          {(pdfFile.size / 1024 / 1024).toFixed(2)} MB — click to change
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-10 w-10 mx-auto" style={{ color: "rgba(0,0,0,0.25)" }} />
                      <p className="font-medium" style={{ color: "rgba(0,0,0,0.5)" }}>
                        Drop PDF here or click to browse
                      </p>
                    </div>
                  )}
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handlePdfFile(f);
                    }}
                  />
                </div>

                {extractError && (
                  <div
                    className="flex items-start gap-2 rounded-xl p-4 text-sm"
                    style={{
                      backgroundColor: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#b91c1c",
                    }}
                  >
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{extractError}</span>
                  </div>
                )}

                {pdfFile && !anthropicKey && (
                  <p className="text-sm text-center" style={{ color: "rgba(0,0,0,0.45)" }}>
                    Add your Anthropic API key in{" "}
                    <button
                      onClick={() => setSettingsOpen(true)}
                      className="underline font-medium"
                    >
                      settings ⚙
                    </button>{" "}
                    to continue.
                  </p>
                )}

                {pdfFile && anthropicKey && (
                  <button
                    onClick={handleExtract}
                    className="w-full py-4 rounded-2xl font-bold text-base transition-all"
                    style={{ backgroundColor: "#F9FB75", color: "#000" }}
                  >
                    Read the script →
                  </button>
                )}
              </>
            )}

            {phase === 3 && (
              <BobMessage>
                <div className="flex items-center gap-3">
                  <Loader2
                    className="h-5 w-5 animate-spin shrink-0"
                    style={{ color: "#CE99F2" }}
                  />
                  <span>
                    Reading through the script... this can take a minute or two!
                  </span>
                </div>
              </BobMessage>
            )}
          </>
        )}

        {/* ════ PHASE 4: Content preview ════ */}
        {phase >= 4 && courseStructure && (
          <>
            <BobMessage>
              Done! Found {courseStructure.sections.length} section
              {courseStructure.sections.length !== 1 ? "s" : ""} with{" "}
              {courseStructure.sections.reduce(
                (s, sec) => s + sec.lessons.length,
                0
              )}{" "}
              lessons. Take a look and edit anything that looks off:
            </BobMessage>

            <div
              className="bg-white rounded-2xl overflow-hidden p-5"
              style={{ border: "1px solid rgba(0,0,0,0.08)" }}
            >
              <ContentPreview
                course={courseStructure}
                onChange={setCourseStructure}
                onNext={confirmPreview}
              />
            </div>
          </>
        )}

        {/* ════ PHASE 5: ZIP / image upload ════ */}
        {phase >= 5 && (
          <>
            <BobMessage>
              {zipFile
                ? `Got your photos from "${zipFile.name}"!`
                : "Now drag your ZIP folder of photos:"}
            </BobMessage>

            {phase === 5 && (
              <div
                className="rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all"
                style={{
                  borderColor: isDraggingZip
                    ? "#95E1ED"
                    : "rgba(0,0,0,0.15)",
                  backgroundColor: isDraggingZip ? "#f0feff" : "#fff",
                }}
                onClick={() => zipInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingZip(true);
                }}
                onDragLeave={() => setIsDraggingZip(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingZip(false);
                  const f = e.dataTransfer.files[0];
                  if (f) handleZipFile(f);
                }}
              >
                {isProcessingZip ? (
                  <div className="flex items-center justify-center gap-3">
                    <Loader2
                      className="h-8 w-8 animate-spin"
                      style={{ color: "#95E1ED" }}
                    />
                    <span className="font-medium">Extracting images...</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <FolderOpen
                      className="h-10 w-10 mx-auto"
                      style={{ color: "rgba(0,0,0,0.25)" }}
                    />
                    <p
                      className="font-medium"
                      style={{ color: "rgba(0,0,0,0.5)" }}
                    >
                      Drop ZIP folder here or click to browse
                    </p>
                    <p
                      className="text-sm"
                      style={{ color: "rgba(0,0,0,0.35)" }}
                    >
                      Images will be auto-matched to placeholders by filename order
                    </p>
                  </div>
                )}
                <input
                  ref={zipInputRef}
                  type="file"
                  accept=".zip,application/zip"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleZipFile(f);
                  }}
                />
              </div>
            )}
          </>
        )}

        {/* ════ PHASE 6: Image matching ════ */}
        {phase >= 6 && courseStructure && (
          <>
            {zipFile && (
              <UserBubble>{zipFile.name}</UserBubble>
            )}

            <BobMessage>
              Here&apos;s how I matched your photos to the placeholders. You can
              swap any that look wrong:
            </BobMessage>

            <div
              className="bg-white rounded-2xl overflow-hidden p-5"
              style={{ border: "1px solid rgba(0,0,0,0.08)" }}
            >
              <ImageMatcher
                course={courseStructure}
                imageAssignments={imageAssignments}
                onAssignmentsChange={setImageAssignments}
                onNext={confirmImages}
              />
            </div>
          </>
        )}

        {/* ════ PHASE 7: Genially interactives ════ */}
        {phase >= 7 && courseStructure && (
          <>
            <BobMessage>
              Okay, here are the interactives you&apos;ll need to upload. Paste
              in the Genially embed URLs:
            </BobMessage>

            <div
              className="bg-white rounded-2xl overflow-hidden p-5"
              style={{ border: "1px solid rgba(0,0,0,0.08)" }}
            >
              <GeniallyLinker
                course={courseStructure}
                circleToken={circleToken}
                spaceGroupId={spaceGroupId}
                geniallyUrls={geniallyUrls}
                imageAssignments={imageDataUrls}
                onUrlsChange={setGeniallyUrls}
                onImportStart={() => {
                  setIsImporting(true);
                  setImportProgress([]);
                  setImportLog(null);
                  setImportError(null);
                  setPhase(8);
                }}
                onProgress={(event) =>
                  setImportProgress((prev) => [...prev, event])
                }
                onComplete={(log) => {
                  setImportLog(log);
                  setIsImporting(false);
                }}
                onError={(message) => {
                  setImportError(message);
                  setIsImporting(false);
                }}
              />
            </div>
          </>
        )}

        {/* ════ PHASE 8: Import progress ════ */}
        {phase >= 8 && (
          <>
            <BobMessage>
              {importLog
                ? "All done! Your course is live in Circle. 🎉"
                : importError
                ? "Hmm, something went wrong. Check the error below:"
                : "Ready to build! 🏗️ Sending everything to Circle..."}
            </BobMessage>

            <ImportProgress
              progress={importProgress}
              log={importLog}
              error={importError}
              isImporting={isImporting}
            />
          </>
        )}

        <div ref={bottomRef} className="h-8" />
      </main>
    </div>
  );
}
