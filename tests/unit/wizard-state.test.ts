import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWizardState, hasImages, hasGenially, type AppState, type Action } from "@/hooks/use-wizard-state";
import type { CourseStructure } from "@/lib/schema";

function reduce(actions: Action[]): AppState {
  const { result } = renderHook(() => useWizardState());
  for (const a of actions) {
    act(() => result.current[1](a));
  }
  return result.current[0];
}

const INIT: Action = { type: "INIT", circleToken: "tok", anthropicKey: "key", spaceGroupId: "123" };

const COURSE_WITH_IMAGES: CourseStructure = {
  name: "Test", slug: "test",
  sections: [{
    name: "S1", lessons: [{
      name: "L1", blocks: [
        { type: "text", html: "<p>Hi</p>" },
        { type: "image_placeholder", index: 1, description: "Photo" },
      ],
    }],
  }],
};

const COURSE_WITH_GENIALLY: CourseStructure = {
  name: "Test", slug: "test",
  sections: [{
    name: "S1", lessons: [{
      name: "L1", blocks: [
        { type: "text", html: "<p>Hi</p>" },
        { type: "genially_placeholder", name: "gen1", description: "Interactive" },
      ],
    }],
  }],
};

const COURSE_PLAIN: CourseStructure = {
  name: "Test", slug: "test",
  sections: [{
    name: "S1", lessons: [{
      name: "L1", blocks: [{ type: "text", html: "<p>Hi</p>" }],
    }],
  }],
};

describe("useWizardState — initial state", () => {
  it("starts at greeting phase", () => {
    const s = reduce([]);
    expect(s.phase).toBe("greeting");
    expect(s.visited).toEqual(["greeting"]);
  });
});

describe("useWizardState — INIT", () => {
  it("sets credentials", () => {
    const s = reduce([INIT]);
    expect(s.circleToken).toBe("tok");
    expect(s.anthropicKey).toBe("key");
    expect(s.spaceGroupId).toBe("123");
  });
});

describe("useWizardState — settings", () => {
  it("OPEN/CLOSE_SETTINGS toggles", () => {
    let s = reduce([{ type: "OPEN_SETTINGS" }]);
    expect(s.settingsOpen).toBe(true);
    s = reduce([{ type: "OPEN_SETTINGS" }, { type: "CLOSE_SETTINGS" }]);
    expect(s.settingsOpen).toBe(false);
  });

  it("CLOSE_SETTINGS clears keyNudge", () => {
    const s = reduce([
      { type: "SHOW_KEY_NUDGE", message: "Set keys!" },
      { type: "CLOSE_SETTINGS" },
    ]);
    expect(s.keyNudge).toBeNull();
  });
});

describe("useWizardState — phase progression", () => {
  it("greeting → content-type", () => {
    const s = reduce([{ type: "ADVANCE_FROM_GREETING" }]);
    expect(s.phase).toBe("content-type");
    expect(s.visited).toContain("content-type");
  });

  it("content-type → number-selection", () => {
    const s = reduce([
      { type: "ADVANCE_FROM_GREETING" },
      { type: "SELECT_CONTENT_TYPE", contentType: "module" },
    ]);
    expect(s.phase).toBe("number-selection");
    expect(s.contentType).toBe("module");
  });

  it("number → pdf-upload", () => {
    const s = reduce([
      { type: "ADVANCE_FROM_GREETING" },
      { type: "SELECT_CONTENT_TYPE", contentType: "milestone" },
      { type: "SELECT_NUMBER", number: 3 },
    ]);
    expect(s.phase).toBe("pdf-upload");
    expect(s.contentNumber).toBe(3);
  });

  it("pdf-upload → extracting (increments trigger)", () => {
    const file = new File(["test"], "test.pdf", { type: "application/pdf" });
    const s = reduce([
      { type: "ADVANCE_FROM_GREETING" },
      { type: "SELECT_CONTENT_TYPE", contentType: "module" },
      { type: "SELECT_NUMBER", number: 1 },
      { type: "SET_PDF_FILE", file, fileName: "test.pdf" },
    ]);
    expect(s.phase).toBe("extracting");
    expect(s.extractionTrigger).toBe(1);
    expect(s.pdfFileName).toBe("test.pdf");
  });

  it("extraction complete → review-extraction", () => {
    const s = reduce([{ type: "EXTRACTION_COMPLETE", course: COURSE_PLAIN }]);
    expect(s.phase).toBe("review-extraction");
    expect(s.courseStructure).toBe(COURSE_PLAIN);
  });
});

describe("useWizardState — CONFIRM_EXTRACTION routing", () => {
  it("skips to importing when no images and no genially", () => {
    const s = reduce([
      { type: "EXTRACTION_COMPLETE", course: COURSE_PLAIN },
      { type: "CONFIRM_EXTRACTION" },
    ]);
    expect(s.phase).toBe("importing");
    expect(s.reviewConfirmed).toBe(true);
  });

  it("goes to image-upload when course has image placeholders", () => {
    const s = reduce([
      { type: "EXTRACTION_COMPLETE", course: COURSE_WITH_IMAGES },
      { type: "CONFIRM_EXTRACTION" },
    ]);
    expect(s.phase).toBe("image-upload");
  });

  it("goes to genially-links when course has genially but no images", () => {
    const s = reduce([
      { type: "EXTRACTION_COMPLETE", course: COURSE_WITH_GENIALLY },
      { type: "CONFIRM_EXTRACTION" },
    ]);
    expect(s.phase).toBe("genially-links");
  });
});

describe("useWizardState — image/genially flow", () => {
  it("SET_ZIP_IMAGES advances to image-matching", () => {
    const s = reduce([
      { type: "EXTRACTION_COMPLETE", course: COURSE_WITH_IMAGES },
      { type: "CONFIRM_EXTRACTION" },
      { type: "SET_ZIP_IMAGES", images: [{ name: "img.jpg", dataUrl: "data:..." }] },
    ]);
    expect(s.phase).toBe("image-matching");
  });

  it("CONFIRM_IMAGE_MATCHING skips to importing when no genially", () => {
    const s = reduce([
      { type: "EXTRACTION_COMPLETE", course: COURSE_WITH_IMAGES },
      { type: "CONFIRM_EXTRACTION" },
      { type: "SET_ZIP_IMAGES", images: [] },
      { type: "CONFIRM_IMAGE_MATCHING" },
    ]);
    expect(s.phase).toBe("importing");
  });

  it("CONFIRM_GENIALLY advances to importing", () => {
    const s = reduce([
      { type: "EXTRACTION_COMPLETE", course: COURSE_WITH_GENIALLY },
      { type: "CONFIRM_EXTRACTION" },
      { type: "CONFIRM_GENIALLY" },
    ]);
    expect(s.phase).toBe("importing");
  });
});

describe("useWizardState — import flow", () => {
  it("TRIGGER_IMPORT increments trigger and resets state", () => {
    const s = reduce([{ type: "TRIGGER_IMPORT" }]);
    expect(s.importTrigger).toBe(1);
    expect(s.importProgress).toEqual([]);
    expect(s.importError).toBeNull();
  });

  it("IMPORT_PROGRESS appends event", () => {
    const event = { type: "progress" as const, message: "Step 1", step: 1, total: 5 };
    const s = reduce([
      { type: "TRIGGER_IMPORT" },
      { type: "IMPORT_PROGRESS", event },
    ]);
    expect(s.importProgress).toHaveLength(1);
    expect(s.importStatus).toBe("Step 1");
  });

  it("IMPORT_COMPLETE advances to complete", () => {
    const log = { courseId: 1, courseName: "Test", sections: [], interactives: [] };
    const s = reduce([{ type: "IMPORT_COMPLETE", log }]);
    expect(s.phase).toBe("complete");
    expect(s.importLog).toBe(log);
    expect(s.importError).toBeNull();
  });

  it("IMPORT_ERROR stores error and partial", () => {
    const partial = { courseId: 1, courseName: "Test", sections: [], interactives: [] };
    const s = reduce([{ type: "IMPORT_ERROR", error: "Failed", partial }]);
    expect(s.importError).toBe("Failed");
    expect(s.importPartial).toBe(partial);
  });

  it("RETRY_IMPORT resets and increments trigger", () => {
    const s = reduce([
      { type: "IMPORT_ERROR", error: "Failed" },
      { type: "RETRY_IMPORT" },
    ]);
    expect(s.importError).toBeNull();
    expect(s.importPartial).toBeNull();
    expect(s.importTrigger).toBe(1);
  });
});

describe("useWizardState — consolidation flow", () => {
  it("OFFER_CONSOLIDATE sets flag", () => {
    const s = reduce([{ type: "OFFER_CONSOLIDATE" }]);
    expect(s.consolidateOffered).toBe(true);
  });

  it("DECLINE_CONSOLIDATE sets flag", () => {
    const s = reduce([{ type: "DECLINE_CONSOLIDATE" }]);
    expect(s.consolidateDeclined).toBe(true);
  });

  it("START_CONSOLIDATE advances phase", () => {
    const s = reduce([{ type: "START_CONSOLIDATE" }]);
    expect(s.phase).toBe("consolidate");
  });

  it("CONSOLIDATE_COMPLETE advances phase", () => {
    const log = { courseId: 99, courseName: "Combined", sections: [] };
    const s = reduce([
      { type: "START_CONSOLIDATE" },
      { type: "CONSOLIDATE_COMPLETE", log },
    ]);
    expect(s.phase).toBe("consolidate-complete");
    expect(s.consolidateLog).toBe(log);
  });

  it("CONSOLIDATE_ERROR stores error", () => {
    const s = reduce([{ type: "CONSOLIDATE_ERROR", error: "Oops" }]);
    expect(s.consolidateError).toBe("Oops");
  });
});

describe("useWizardState — visited tracking", () => {
  it("does not duplicate phases in visited", () => {
    const s = reduce([
      { type: "ADVANCE_FROM_GREETING" },
      { type: "SELECT_CONTENT_TYPE", contentType: "module" },
    ]);
    // greeting should only appear once
    const greetingCount = s.visited.filter((p) => p === "greeting").length;
    expect(greetingCount).toBe(1);
  });
});

describe("useWizardState — extraction error/retry", () => {
  it("EXTRACTION_ERROR stores error", () => {
    const s = reduce([{ type: "EXTRACTION_ERROR", error: "Timeout" }]);
    expect(s.extractionError).toBe("Timeout");
  });

  it("RETRY_EXTRACTION resets error and increments trigger", () => {
    const s = reduce([
      { type: "EXTRACTION_ERROR", error: "Timeout" },
      { type: "RETRY_EXTRACTION" },
    ]);
    expect(s.extractionError).toBeNull();
    expect(s.extractionTrigger).toBe(1);
  });
});

describe("hasImages / hasGenially helpers", () => {
  it("hasImages returns true when image_placeholder present", () => {
    expect(hasImages(COURSE_WITH_IMAGES)).toBe(true);
  });

  it("hasImages returns false when no image_placeholder", () => {
    expect(hasImages(COURSE_PLAIN)).toBe(false);
  });

  it("hasGenially returns true when genially_placeholder present", () => {
    expect(hasGenially(COURSE_WITH_GENIALLY)).toBe(true);
  });

  it("hasGenially returns false when no genially_placeholder", () => {
    expect(hasGenially(COURSE_PLAIN)).toBe(false);
  });
});
