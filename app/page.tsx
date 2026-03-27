"use client";

import * as React from "react";
import { CourseStructure } from "@/lib/schema";
import { ImportLog } from "@/app/api/import/route";
import { ProgressEvent } from "@/components/genially-linker";
import { ApiKeyForm } from "@/components/api-key-form";
import { PdfUpload } from "@/components/pdf-upload";
import { ContentPreview } from "@/components/content-preview";
import { ImageMatcher } from "@/components/image-matcher";
import { GeniallyLinker } from "@/components/genially-linker";
import { ImportProgress } from "@/components/import-progress";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

type Step = 1 | 2 | 3;

interface ImageAssignment {
  file: File;
  dataUrl: string;
}

const STEP_LABELS: Record<Step, string> = {
  1: "Extract",
  2: "Images",
  3: "Import",
};

const STEP_DESCRIPTIONS: Record<Step, string> = {
  1: "Upload PDF → Extract course structure with Claude",
  2: "Match image placeholders to uploaded images",
  3: "Link Genially embeds → Import to Circle LMS",
};

export default function HomePage() {
  const [step, setStep] = React.useState<Step>(1);
  const [circleToken, setCircleToken] = React.useState("");
  const [anthropicKey, setAnthropicKey] = React.useState("");
  const [spaceGroupId, setSpaceGroupId] = React.useState("");
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

  // Load from localStorage on mount
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setCircleToken(localStorage.getItem("bv_circle_token") ?? "");
      setAnthropicKey(localStorage.getItem("bv_anthropic_key") ?? "");
      setSpaceGroupId(localStorage.getItem("bv_space_group_id") ?? "");
    }
  }, []);

  function handleExtracted(course: CourseStructure) {
    setCourseStructure(course);
    setStep(1);
  }

  function goToStep(s: Step) {
    setStep(s);
  }

  const showPreview = step === 1 && courseStructure !== null;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header
        className="sticky top-0 z-40 border-b border-black/10 bg-white"
        style={{ backgroundColor: "#000" }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="font-bold text-lg tracking-tight text-white">
                bV Migrate
              </span>
              <span
                className="hidden sm:block text-xs px-2 py-0.5 rounded-full text-black font-medium"
                style={{ backgroundColor: "#F9FB75" }}
              >
                Circle LMS Import Tool
              </span>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-1">
              {([1, 2, 3] as Step[]).map((s) => (
                <React.Fragment key={s}>
                  <button
                    onClick={() => {
                      if (
                        s === 1 ||
                        (s === 2 && courseStructure) ||
                        (s === 3 && courseStructure)
                      ) {
                        goToStep(s);
                      }
                    }}
                    disabled={
                      s === 2 && !courseStructure ||
                      s === 3 && !courseStructure
                    }
                    className={[
                      "flex items-center gap-1.5 rounded-md px-3 py-1 text-sm transition-colors",
                      step === s
                        ? "bg-white text-black font-semibold"
                        : "text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold",
                        step === s
                          ? "bg-black text-white"
                          : "bg-white/20 text-white",
                      ].join(" ")}
                    >
                      {s}
                    </span>
                    <span className="hidden sm:block">{STEP_LABELS[s]}</span>
                  </button>
                  {s < 3 && (
                    <span className="text-white/30 text-sm">›</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="hidden lg:block w-72 shrink-0 space-y-4">
            <ApiKeyForm
              circleToken={circleToken}
              anthropicKey={anthropicKey}
              spaceGroupId={spaceGroupId}
              onCircleTokenChange={setCircleToken}
              onAnthropicKeyChange={setAnthropicKey}
              onSpaceGroupIdChange={setSpaceGroupId}
            />
            {courseStructure && (
              <div className="rounded-xl border border-black/10 bg-white p-4 space-y-2">
                <p className="text-xs font-semibold text-black/40 uppercase tracking-wide">
                  Course
                </p>
                <p className="font-medium text-sm">{courseStructure.name}</p>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="secondary">
                    {courseStructure.sections.length} sections
                  </Badge>
                  <Badge variant="secondary">
                    {courseStructure.sections.reduce(
                      (s, sec) => s + sec.lessons.length,
                      0
                    )}{" "}
                    lessons
                  </Badge>
                </div>
                <Separator />
                <nav className="space-y-1">
                  {([1, 2, 3] as Step[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        if (
                          s === 1 ||
                          courseStructure
                        ) {
                          goToStep(s);
                        }
                      }}
                      className={[
                        "w-full text-left rounded-md px-3 py-2 text-sm transition-colors",
                        step === s
                          ? "bg-black text-white font-medium"
                          : "hover:bg-black/5",
                      ].join(" ")}
                    >
                      <span className="text-xs mr-2 opacity-50">{s}.</span>
                      {STEP_DESCRIPTIONS[s]}
                    </button>
                  ))}
                </nav>
              </div>
            )}
          </aside>

          {/* Main area */}
          <main className="flex-1 min-w-0 space-y-6">
            {/* Mobile API key form */}
            <div className="lg:hidden">
              <ApiKeyForm
                circleToken={circleToken}
                anthropicKey={anthropicKey}
                spaceGroupId={spaceGroupId}
                onCircleTokenChange={setCircleToken}
                onAnthropicKeyChange={setAnthropicKey}
                onSpaceGroupIdChange={setSpaceGroupId}
              />
            </div>

            {/* Step header */}
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                {step > 1 && courseStructure && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => goToStep((step - 1) as Step)}
                    className="h-7 w-7 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                )}
                <h1 className="text-2xl font-bold">
                  Step {step}: {STEP_LABELS[step]}
                </h1>
              </div>
              <p className="text-black/60">{STEP_DESCRIPTIONS[step]}</p>
            </div>

            <Separator />

            {/* Step 1: Extract */}
            {step === 1 && !courseStructure && (
              <PdfUpload
                anthropicKey={anthropicKey}
                onExtracted={handleExtracted}
              />
            )}

            {step === 1 && courseStructure && (
              <ContentPreview
                course={courseStructure}
                onChange={setCourseStructure}
                onNext={() => setStep(2)}
              />
            )}

            {/* Step 2: Images */}
            {step === 2 && courseStructure && (
              <ImageMatcher
                course={courseStructure}
                imageAssignments={imageAssignments}
                onAssignmentsChange={setImageAssignments}
                onNext={() => setStep(3)}
              />
            )}

            {/* Step 3: Import */}
            {step === 3 && courseStructure && (
              <div className="space-y-6">
                <GeniallyLinker
                  course={courseStructure}
                  circleToken={circleToken}
                  spaceGroupId={spaceGroupId}
                  geniallyUrls={geniallyUrls}
                  onUrlsChange={setGeniallyUrls}
                  onImportStart={() => {
                    setIsImporting(true);
                    setImportProgress([]);
                    setImportLog(null);
                    setImportError(null);
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
                <ImportProgress
                  progress={importProgress}
                  log={importLog}
                  error={importError}
                  isImporting={isImporting}
                />
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
