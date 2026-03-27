"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ImportLog } from "@/app/api/import/route";
import { ProgressEvent } from "@/components/genially-linker";
import {
  CheckCircle2,
  Download,
  AlertCircle,
  Loader2,
  BookOpen,
  Layers,
  Gamepad2,
} from "lucide-react";

interface ImportProgressProps {
  progress: ProgressEvent[];
  log: ImportLog | null;
  error: string | null;
  isImporting: boolean;
}

export function ImportProgress({
  progress,
  log,
  error,
  isImporting,
}: ImportProgressProps) {
  const latest = progress[progress.length - 1];
  const percent =
    latest && latest.total > 0
      ? Math.round((latest.step / latest.total) * 100)
      : 0;

  function handleDownload() {
    if (!log) return;
    const blob = new Blob([JSON.stringify(log, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bv-migrate-log-${log.courseId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!isImporting && !log && !error && progress.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {(isImporting || (progress.length > 0 && !log)) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm font-medium">
                {latest?.message ?? "Starting import..."}
              </span>
            </div>
            <Progress value={percent} />
            {latest && (
              <p className="text-xs text-black/50 text-right">
                {latest.step} / {latest.total} steps
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-700">Import failed</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {log && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-green-800">
              <CheckCircle2 className="h-5 w-5" />
              Import Complete!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge className="bg-green-700">Course ID: {log.courseId}</Badge>
              <span className="text-sm font-medium text-green-800">
                {log.courseName}
              </span>
            </div>

            <div className="space-y-3">
              {log.sections.map((section) => (
                <div key={section.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-green-700" />
                    <span className="text-sm font-medium text-green-800">
                      {section.name}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      ID: {section.id}
                    </Badge>
                  </div>
                  <div className="ml-6 space-y-0.5">
                    {section.lessons.map((lesson) => (
                      <div
                        key={lesson.id}
                        className="flex items-center gap-2 text-sm text-green-700"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>{lesson.name}</span>
                        <span className="text-xs text-green-500">
                          ID: {lesson.id}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {log.interactives.length > 0 && (
              <div className="space-y-2 border-t border-green-200 pt-3">
                <p className="text-sm font-medium text-green-800 flex items-center gap-1">
                  <Gamepad2 className="h-4 w-4" />
                  Interactive Elements ({log.interactives.length})
                </p>
                {log.interactives.map((item, i) => (
                  <div
                    key={i}
                    className="text-xs text-green-700 bg-green-100 rounded p-2"
                  >
                    <p>
                      <span className="font-medium">{item.placeholderName}</span>{" "}
                      in {item.lessonName}
                    </p>
                    <p className="text-green-600 truncate">{item.embedUrl}</p>
                  </div>
                ))}
              </div>
            )}

            <Button
              onClick={handleDownload}
              variant="secondary"
              className="w-full border-green-300"
            >
              <Download className="h-4 w-4" />
              Download Import Log (JSON)
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
