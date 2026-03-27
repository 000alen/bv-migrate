"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CourseStructure } from "@/lib/schema";
import { ImportLog } from "@/app/api/import/route";
import { Gamepad2, AlertCircle, Upload } from "lucide-react";

interface GeniallyLinkerProps {
  course: CourseStructure;
  circleToken: string;
  spaceGroupId: string;
  geniallyUrls: Record<string, string>;
  onUrlsChange: (urls: Record<string, string>) => void;
  onImportStart: () => void;
  onProgress: (event: ProgressEvent) => void;
  onComplete: (log: ImportLog) => void;
  onError: (message: string) => void;
}

interface GeniallyPlaceholder {
  name: string;
  description: string;
  lessonName: string;
  sectionName: string;
}

export interface ProgressEvent {
  type: "progress";
  message: string;
  step: number;
  total: number;
}

function collectGeniallyPlaceholders(
  course: CourseStructure
): GeniallyPlaceholder[] {
  const seen = new Set<string>();
  const result: GeniallyPlaceholder[] = [];
  for (const section of course.sections) {
    for (const lesson of section.lessons) {
      for (const block of lesson.blocks) {
        if (block.type === "genially_placeholder" && !seen.has(block.name)) {
          seen.add(block.name);
          result.push({
            name: block.name,
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

export function GeniallyLinker({
  course,
  circleToken,
  spaceGroupId,
  geniallyUrls,
  onUrlsChange,
  onImportStart,
  onProgress,
  onComplete,
  onError,
}: GeniallyLinkerProps) {
  const placeholders = React.useMemo(
    () => collectGeniallyPlaceholders(course),
    [course]
  );

  const [isImporting, setIsImporting] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(null);

  const canImport = !!circleToken && !!spaceGroupId && !isImporting;

  async function handleImport() {
    if (!canImport) return;

    if (!circleToken.trim()) {
      setValidationError("Circle API token is required.");
      return;
    }
    if (!spaceGroupId.trim() || isNaN(parseInt(spaceGroupId))) {
      setValidationError("Valid Space Group ID is required.");
      return;
    }
    setValidationError(null);
    setIsImporting(true);
    onImportStart();

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course,
          circleToken,
          spaceGroupId: parseInt(spaceGroupId),
          geniallyUrls,
          imageAssignments: {},
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (!reader) throw new Error("No response body");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const chunk of lines) {
          const line = chunk.trim();
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "progress") {
              onProgress(event as ProgressEvent);
            } else if (event.type === "complete") {
              onComplete(event.log as ImportLog);
            } else if (event.type === "error") {
              onError(event.message as string);
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {placeholders.length === 0 ? (
        <Card className="border-dashed border-2 border-black/20">
          <CardContent className="flex flex-col items-center justify-center py-8 gap-2">
            <Gamepad2 className="h-8 w-8 text-black/20" />
            <p className="text-black/50 text-center text-sm">
              No Genially placeholders found in this course.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {placeholders.map((placeholder) => (
            <Card key={placeholder.name}>
              <CardContent className="p-4 space-y-2">
                <div>
                  <p className="font-medium text-sm flex items-center gap-2">
                    <Gamepad2 className="h-4 w-4 text-rose-500" />
                    {placeholder.name}
                  </p>
                  <p className="text-xs text-black/50">
                    {placeholder.sectionName} → {placeholder.lessonName}
                  </p>
                  <p className="text-xs text-black/60 mt-1">
                    {placeholder.description}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`genially-${placeholder.name}`} className="text-xs">
                    Genially embed URL
                  </Label>
                  <Input
                    id={`genially-${placeholder.name}`}
                    placeholder="https://view.genially.com/..."
                    value={geniallyUrls[placeholder.name] ?? ""}
                    onChange={(e) =>
                      onUrlsChange({
                        ...geniallyUrls,
                        [placeholder.name]: e.target.value,
                      })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {validationError && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {validationError}
        </div>
      )}

      {(!circleToken || !spaceGroupId) && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Set your Circle API token and Space Group ID in the sidebar before importing.
        </div>
      )}

      <Button
        onClick={handleImport}
        disabled={!canImport}
        className="w-full"
        size="lg"
        style={{ backgroundColor: canImport ? "#CE99F2" : undefined, color: canImport ? "#000" : undefined }}
      >
        {isImporting ? (
          <>
            <Upload className="h-4 w-4 animate-pulse" />
            Importing to Circle...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Import to Circle
          </>
        )}
      </Button>
    </div>
  );
}
