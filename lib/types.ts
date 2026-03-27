export type ContentType = "module" | "milestone" | "micromodule";

export interface ImportProgressEvent {
  type: "progress";
  message: string;
  step: number;
  total: number;
}

export interface ImportLog {
  courseId: number;
  courseName: string;
  sections: Array<{
    id: number;
    name: string;
    lessons: Array<{ id: number; name: string }>;
  }>;
  interactives: Array<{
    lessonName: string;
    placeholderName: string;
    embedUrl: string;
  }>;
  uploadedImages?: Array<{
    lessonName: string;
    placeholderIndex: number;
    description: string;
    signedId: string;
  }>;
}

export interface ImportHistory {
  id: string;
  timestamp: string;
  courseName: string;
  spaceId: number;
  sectionCount: number;
  lessonCount: number;
  contentType: string;
  contentNumber: number;
}

export interface PartialImportCreated {
  courseId: number | null;
  sections: Array<{
    id: number;
    name: string;
    lessons: Array<{ id: number; name: string }>;
  }>;
}

export interface ZipImage {
  name: string;
  dataUrl: string;
}
