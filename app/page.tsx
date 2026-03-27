"use client";

import { useEffect, useRef } from "react";
import { Settings } from "lucide-react";
import { ErrorBoundary } from "@/components/error-boundary";
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
import { ConsolidateStep } from "@/components/steps/consolidate-step";
import { useWizardState, type Phase } from "@/hooks/use-wizard-state";
import { useExtraction } from "@/hooks/use-extraction";
import { useImport } from "@/hooks/use-import";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const [s, dispatch] = useWizardState();
  const endRef = useRef<HTMLDivElement>(null);

  useExtraction(s, dispatch);
  useImport(s, dispatch);

  // Load settings from localStorage
  useEffect(() => {
    dispatch({
      type: "INIT",
      circleToken: localStorage.getItem("bv_circle_token") ?? "",
      anthropicKey: localStorage.getItem("bv_anthropic_key") ?? "",
      spaceGroupId: localStorage.getItem("bv_space_group_id") ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-advance from greeting
  useEffect(() => {
    if (s.phase !== "greeting") return;
    const t = setTimeout(() => dispatch({ type: "ADVANCE_FROM_GREETING" }), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase]);

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [s.visited.length, s.extractionStatus, s.importStatus, s.importLog]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const seen = (p: Phase) => s.visited.includes(p);
  const ct = s.contentType ? s.contentType[0].toUpperCase() + s.contentType.slice(1) : "";
  const maxN = s.contentType === "module" ? 9 : 4;
  const totalLessons = s.courseStructure?.sections.reduce((n, sec) => n + sec.lessons.length, 0) ?? 0;

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
            <BobMessage message="Note: Images will be listed as placeholders in your Circle lessons. You'll need to insert the actual images through Circle's editor after import — it's a platform limitation we're working around!" />
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
        {seen("importing") && s.courseStructure && (
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
              partial={s.importPartial}
              sectionCount={s.courseStructure.sections.length}
              lessonCount={totalLessons}
              onTrigger={() =>
                requireImportKeys(() => dispatch({ type: "TRIGGER_IMPORT" }))
              }
              onRetry={() => dispatch({ type: "RETRY_IMPORT" })}
            />
          </>
        )}

        {/* Step 10: Complete */}
        {seen("complete") && (
          <>
            <BobMessage message="All done! 🎉 Your course is live on Circle (as drafts)." />
            {!s.consolidateOffered && !s.consolidateDeclined && !seen("consolidate") && (
              <div className="animate-fade-in rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
                <p className="text-sm text-gray-700">Want to combine this with other modules into one Circle course?</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      dispatch({ type: "OFFER_CONSOLIDATE" });
                      dispatch({ type: "START_CONSOLIDATE" });
                    }}
                    className="h-9 px-4 rounded-lg text-sm font-semibold transition-colors text-white bg-brand-purple"
                  >
                    Yes, combine modules
                  </button>
                  <button
                    onClick={() => dispatch({ type: "DECLINE_CONSOLIDATE" })}
                    className="h-9 px-4 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    No thanks
                  </button>
                </div>
              </div>
            )}
            {s.consolidateDeclined && !seen("consolidate") && (
              <UserBubble>No thanks</UserBubble>
            )}
          </>
        )}

        {/* Step 11: Consolidate */}
        {seen("consolidate") && (
          <>
            <BobMessage message="Let's combine your modules into one course! Select which ones to include:" />
            {s.consolidateError && (
              <div className="animate-fade-in rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                Error: {s.consolidateError}
              </div>
            )}
            {!seen("consolidate-complete") && (
              <ConsolidateStep
                circleToken={s.circleToken}
                spaceGroupId={s.spaceGroupId}
                onComplete={(log) => dispatch({ type: "CONSOLIDATE_COMPLETE", log })}
                onError={(error) => dispatch({ type: "CONSOLIDATE_ERROR", error })}
              />
            )}
          </>
        )}

        {/* Step 12: Consolidate complete */}
        {seen("consolidate-complete") && s.consolidateLog && (
          <BobMessage
            message={`All done! 🎉 Combined course "${s.consolidateLog.courseName}" created on Circle with ${s.consolidateLog.sections.length} section${s.consolidateLog.sections.length !== 1 ? "s" : ""}.`}
          />
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
        onCircleToken={(v) => dispatch({ type: "SET_CIRCLE_TOKEN", value: v })}
        onAnthropicKey={(v) => dispatch({ type: "SET_ANTHROPIC_KEY", value: v })}
        onSpaceGroupId={(v) => dispatch({ type: "SET_SPACE_GROUP_ID", value: v })}
      />
    </div>
  );
}
