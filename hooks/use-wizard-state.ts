"use client";

import { useReducer } from "react";
import type { CourseStructure } from "@/lib/schema";
import { collectBlocks } from "@/lib/utils";
import type {
  ContentType,
  UploadMode,
  ImportLog,
  ImportProgressEvent,
  ZipImage,
  ConsolidateLog,
} from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LlmProvider = "anthropic" | "cerebras";

export type Phase =
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
  | "complete"
  | "consolidate"
  | "consolidate-complete";

export interface AppState {
  phase: Phase;
  visited: Phase[];
  settingsOpen: boolean;
  keyNudge: string | null;

  circleToken: string;
  anthropicKey: string;
  /** Default: cerebras (local PDF text + Cerebras JSON). Anthropic optional (e.g. native PDF). */
  llmProvider: LlmProvider;
  cerebrasKey: string;
  spaceGroupId: string;

  contentType: ContentType | null;
  contentNumber: number | null;

  uploadMode: UploadMode;
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

  consolidateOffered: boolean;
  consolidateDeclined: boolean;
  consolidateLog: ConsolidateLog | null;
  consolidateError: string | null;
}

export type Action =
  | {
      type: "INIT";
      circleToken: string;
      anthropicKey: string;
      spaceGroupId: string;
      llmProvider: LlmProvider;
      cerebrasKey: string;
    }
  | { type: "OPEN_SETTINGS" }
  | { type: "CLOSE_SETTINGS" }
  | { type: "SET_CIRCLE_TOKEN"; value: string }
  | { type: "SET_ANTHROPIC_KEY"; value: string }
  | { type: "SET_LLM_PROVIDER"; value: LlmProvider }
  | { type: "SET_CEREBRAS_KEY"; value: string }
  | { type: "SET_SPACE_GROUP_ID"; value: string }
  | { type: "SHOW_KEY_NUDGE"; message: string }
  | { type: "ADVANCE_FROM_GREETING" }
  | { type: "SELECT_CONTENT_TYPE"; contentType: ContentType }
  | { type: "SELECT_NUMBER"; number: number }
  | { type: "SET_UPLOAD_MODE"; mode: UploadMode }
  | { type: "SET_PDF_FILE"; file: File; fileName: string }
  | { type: "EXTRACTION_STATUS"; message: string }
  | { type: "EXTRACTION_COMPLETE"; course: CourseStructure; imageData?: Record<number, { filename: string; dataUrl: string }> }
  | { type: "EXTRACTION_ERROR"; error: string }
  | { type: "RETRY_EXTRACTION" }
  | { type: "UPDATE_COURSE"; course: CourseStructure }
  | { type: "CONFIRM_EXTRACTION" }
  | { type: "SET_ZIP_IMAGES"; images: ZipImage[] }
  | { type: "SKIP_IMAGES" }
  | { type: "UPDATE_IMAGE_ASSIGNMENTS"; assignments: Record<number, string> }
  | { type: "CONFIRM_IMAGE_MATCHING" }
  | { type: "UPDATE_GENIALLY_URLS"; urls: Record<string, string> }
  | { type: "CONFIRM_GENIALLY" }
  | { type: "TRIGGER_IMPORT" }
  | { type: "IMPORT_PROGRESS"; event: ImportProgressEvent }
  | { type: "IMPORT_STATUS"; message: string }
  | { type: "IMPORT_COMPLETE"; log: ImportLog }
  | { type: "IMPORT_ERROR"; error: string; partial?: ImportLog | null }
  | { type: "RETRY_IMPORT" }
  | { type: "OFFER_CONSOLIDATE" }
  | { type: "DECLINE_CONSOLIDATE" }
  | { type: "START_CONSOLIDATE" }
  | { type: "CONSOLIDATE_COMPLETE"; log: ConsolidateLog }
  | { type: "CONSOLIDATE_ERROR"; error: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function hasImages(course: CourseStructure) {
  return collectBlocks(course, "image_placeholder").length > 0;
}

export function hasGenially(course: CourseStructure) {
  return collectBlocks(course, "genially_placeholder").length > 0;
}

function visit(
  state: AppState,
  phase: Phase
): Pick<AppState, "phase" | "visited"> {
  return {
    phase,
    visited: state.visited.includes(phase)
      ? state.visited
      : [...state.visited, phase],
  };
}

// ─── Initial state ────────────────────────────────────────────────────────────

const initial: AppState = {
  phase: "greeting",
  visited: ["greeting"],
  settingsOpen: false,
  keyNudge: null,
  circleToken: "",
  anthropicKey: "",
  llmProvider: "cerebras",
  cerebrasKey: "",
  spaceGroupId: "",
  contentType: null,
  contentNumber: null,
  uploadMode: "pdf",
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
  consolidateOffered: false,
  consolidateDeclined: false,
  consolidateLog: null,
  consolidateError: null,
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case "INIT":
      return {
        ...s,
        circleToken: a.circleToken,
        anthropicKey: a.anthropicKey,
        spaceGroupId: a.spaceGroupId,
        llmProvider: a.llmProvider,
        cerebrasKey: a.cerebrasKey,
      };
    case "OPEN_SETTINGS":
      return { ...s, settingsOpen: true };
    case "CLOSE_SETTINGS":
      return { ...s, settingsOpen: false, keyNudge: null };
    case "SET_CIRCLE_TOKEN":
      return { ...s, circleToken: a.value };
    case "SET_ANTHROPIC_KEY":
      return { ...s, anthropicKey: a.value };
    case "SET_LLM_PROVIDER":
      return { ...s, llmProvider: a.value };
    case "SET_CEREBRAS_KEY":
      return { ...s, cerebrasKey: a.value };
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
    case "SET_UPLOAD_MODE":
      return { ...s, uploadMode: a.mode };
    case "SET_PDF_FILE": {
      const detectedMode: UploadMode =
        a.file.name.endsWith(".zip") || a.file.type.includes("zip") ? "rise-zip" : "pdf";
      return {
        ...s,
        uploadMode: detectedMode,
        pdfFile: a.file,
        pdfFileName: a.fileName,
        extractionTrigger: s.extractionTrigger + 1,
        extractionError: null,
        extractionStatus: "",
        ...visit(s, "extracting"),
      };
    }
    case "EXTRACTION_STATUS":
      return { ...s, extractionStatus: a.message };
    case "EXTRACTION_COMPLETE": {
      // For rise-zip mode: pre-populate imageAssignments from the parsed imageData
      if (s.uploadMode === "rise-zip" && a.imageData && Object.keys(a.imageData).length > 0) {
        const zipImages: ZipImage[] = Object.entries(a.imageData).map(([, v]) => ({
          name: v.filename,
          dataUrl: v.dataUrl,
        }));
        const imageAssignments: Record<number, string> = {};
        for (const [idxStr, v] of Object.entries(a.imageData)) {
          imageAssignments[Number(idxStr)] = v.filename;
        }
        return {
          ...s,
          courseStructure: a.course,
          extractionError: null,
          zipImages,
          imageAssignments,
          imageMatchingConfirmed: true,
          ...visit(s, "review-extraction"),
        };
      }
      return { ...s, courseStructure: a.course, extractionError: null, ...visit(s, "review-extraction") };
    }
    case "EXTRACTION_ERROR":
      return { ...s, extractionError: a.error };
    case "RETRY_EXTRACTION":
      return { ...s, extractionError: null, extractionStatus: "", extractionTrigger: s.extractionTrigger + 1 };
    case "UPDATE_COURSE":
      return { ...s, courseStructure: a.course };
    case "CONFIRM_EXTRACTION": {
      const c = s.courseStructure!;
      // rise-zip: images already pre-matched, skip image-upload / image-matching steps
      const skipImageSteps = s.uploadMode === "rise-zip" && s.imageMatchingConfirmed;
      const next = skipImageSteps
        ? hasGenially(c) ? "genially-links" : "importing"
        : hasImages(c) ? "image-upload" : hasGenially(c) ? "genially-links" : "importing";
      return { ...s, reviewConfirmed: true, ...visit(s, next) };
    }
    case "SET_ZIP_IMAGES":
      return { ...s, zipImages: a.images, ...visit(s, "image-matching") };
    case "SKIP_IMAGES": {
      const c = s.courseStructure!;
      const next = hasGenially(c) ? "genially-links" : "importing";
      return { ...s, imageMatchingConfirmed: true, ...visit(s, next) };
    }
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
    case "OFFER_CONSOLIDATE":
      return { ...s, consolidateOffered: true };
    case "DECLINE_CONSOLIDATE":
      return { ...s, consolidateDeclined: true };
    case "START_CONSOLIDATE":
      return { ...s, ...visit(s, "consolidate") };
    case "CONSOLIDATE_COMPLETE":
      return { ...s, consolidateLog: a.log, consolidateError: null, ...visit(s, "consolidate-complete") };
    case "CONSOLIDATE_ERROR":
      return { ...s, consolidateError: a.error };
    default:
      return s;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWizardState() {
  return useReducer(reducer, initial);
}
