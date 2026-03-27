"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CourseStructure } from "@/lib/schema";
import { ArrowRight, ImageIcon, Upload } from "lucide-react";

interface ImageAssignment {
  file: File;
  dataUrl: string;
}

interface ImageMatcherProps {
  course: CourseStructure;
  imageAssignments: Record<number, ImageAssignment>;
  onAssignmentsChange: (assignments: Record<number, ImageAssignment>) => void;
  onNext: () => void;
}

interface ImagePlaceholder {
  index: number;
  description: string;
  lessonName: string;
  sectionName: string;
}

function collectImagePlaceholders(course: CourseStructure): ImagePlaceholder[] {
  const result: ImagePlaceholder[] = [];
  for (const section of course.sections) {
    for (const lesson of section.lessons) {
      for (const block of lesson.blocks) {
        if (block.type === "image_placeholder") {
          result.push({
            index: block.index,
            description: block.description,
            lessonName: lesson.name,
            sectionName: section.name,
          });
        }
      }
    }
  }
  return result;
}

export function ImageMatcher({
  course,
  imageAssignments,
  onAssignmentsChange,
  onNext,
}: ImageMatcherProps) {
  const placeholders = React.useMemo(
    () => collectImagePlaceholders(course),
    [course]
  );

  function handleFile(index: number, file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      onAssignmentsChange({
        ...imageAssignments,
        [index]: { file, dataUrl },
      });
    };
    reader.readAsDataURL(file);
  }

  if (placeholders.length === 0) {
    return (
      <div className="space-y-6">
        <Card className="border-dashed border-2 border-black/20">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <ImageIcon className="h-10 w-10 text-black/20" />
            <p className="text-black/50 text-center">
              No image placeholders found in this course structure.
            </p>
          </CardContent>
        </Card>
        <Button onClick={onNext} className="w-full" size="lg">
          Continue to Genially Linking
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  const assignedCount = Object.keys(imageAssignments).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-black/60">
          {assignedCount} / {placeholders.length} images assigned
        </p>
      </div>

      <div className="space-y-3">
        {placeholders.map((placeholder) => {
          const assignment = imageAssignments[placeholder.index];
          return (
            <Card key={placeholder.index}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-24 h-24 rounded-lg border-2 border-dashed border-black/20 bg-black/5 flex items-center justify-center overflow-hidden">
                    {assignment ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={assignment.dataUrl}
                        alt={placeholder.description}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-black/20" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div>
                      <p className="font-medium text-sm">
                        Image #{placeholder.index}
                      </p>
                      <p className="text-xs text-black/50">
                        {placeholder.sectionName} → {placeholder.lessonName}
                      </p>
                      <p className="text-xs text-black/70 mt-1">
                        {placeholder.description}
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 cursor-pointer text-sm bg-black/5 hover:bg-black/10 transition-colors rounded-md px-3 py-1.5">
                      <Upload className="h-3.5 w-3.5" />
                      {assignment ? "Change image" : "Upload image"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFile(placeholder.index, f);
                        }}
                      />
                    </label>
                    {assignment && (
                      <p className="text-xs text-black/40">
                        {assignment.file.name}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Button onClick={onNext} className="w-full" size="lg">
        Continue to Genially Linking
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
