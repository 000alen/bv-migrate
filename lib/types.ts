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
