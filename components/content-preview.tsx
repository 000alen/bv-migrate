"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CourseStructure, ContentBlock } from "@/lib/schema";
import {
  ChevronDown,
  ChevronRight,
  Edit2,
  X,
  Check,
  ArrowRight,
  BookOpen,
  Layers,
} from "lucide-react";

interface ContentPreviewProps {
  course: CourseStructure;
  onChange: (updated: CourseStructure) => void;
  onNext: () => void;
}

function blockSummary(block: ContentBlock): string {
  switch (block.type) {
    case "text":
      return block.html.replace(/<[^>]+>/g, "").slice(0, 80);
    case "heading":
      return block.text.slice(0, 80);
    case "flashcard":
      return `${block.cards.length} card(s)`;
    case "accordion":
      return `${block.tabs.length} tab(s)`;
    case "quiz":
      return block.question.slice(0, 80);
    case "labeled_image":
      return block.description.slice(0, 80);
    case "sorting_activity":
      return block.description.slice(0, 80);
    case "timeline":
      return block.description.slice(0, 80);
    case "padlet":
      return block.description.slice(0, 80);
    case "checklist":
      return `${block.items.length} item(s)`;
    case "button_stack":
      return `${block.buttons.length} button(s)`;
    case "image_placeholder":
      return `#${block.index}: ${block.description.slice(0, 60)}`;
    case "genially_placeholder":
      return block.name;
    case "quote":
      return block.content.slice(0, 80);
    case "file_attachment":
      return block.name;
    case "survey_embed":
      return block.description.slice(0, 80);
    case "divider":
      return "---";
    default:
      return "";
  }
}

const BLOCK_TYPE_COLORS: Record<string, string> = {
  text: "bg-gray-100 text-gray-700",
  heading: "bg-blue-100 text-blue-700",
  flashcard: "bg-purple-100 text-purple-700",
  accordion: "bg-indigo-100 text-indigo-700",
  quiz: "bg-yellow-100 text-yellow-700",
  labeled_image: "bg-green-100 text-green-700",
  sorting_activity: "bg-orange-100 text-orange-700",
  timeline: "bg-cyan-100 text-cyan-700",
  padlet: "bg-pink-100 text-pink-700",
  checklist: "bg-emerald-100 text-emerald-700",
  button_stack: "bg-violet-100 text-violet-700",
  image_placeholder: "bg-amber-100 text-amber-700",
  genially_placeholder: "bg-rose-100 text-rose-700",
  quote: "bg-slate-100 text-slate-700",
  file_attachment: "bg-teal-100 text-teal-700",
  survey_embed: "bg-lime-100 text-lime-700",
  divider: "bg-gray-100 text-gray-500",
};

interface EditModalProps {
  block: ContentBlock;
  onSave: (updated: ContentBlock) => void;
  onClose: () => void;
}

function EditModal({ block, onSave, onClose }: EditModalProps) {
  const [json, setJson] = React.useState(JSON.stringify(block, null, 2));
  const [parseError, setParseError] = React.useState<string | null>(null);

  function handleSave() {
    try {
      const parsed = JSON.parse(json) as ContentBlock;
      setParseError(null);
      onSave(parsed);
      onClose();
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Invalid JSON");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl p-6 space-y-4 m-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Edit Block ({block.type})</h3>
          <button onClick={onClose} className="text-black/40 hover:text-black">
            <X className="h-5 w-5" />
          </button>
        </div>
        <Textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          className="font-mono text-xs min-h-[300px]"
        />
        {parseError && (
          <p className="text-xs text-red-600">{parseError}</p>
        )}
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Check className="h-4 w-4" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ContentPreview({ course, onChange, onNext }: ContentPreviewProps) {
  const [expandedSections, setExpandedSections] = React.useState<Set<number>>(
    new Set([0])
  );
  const [expandedLessons, setExpandedLessons] = React.useState<Set<string>>(
    new Set()
  );
  const [editingBlock, setEditingBlock] = React.useState<{
    sectionIdx: number;
    lessonIdx: number;
    blockIdx: number;
    block: ContentBlock;
  } | null>(null);
  const [courseName, setCourseName] = React.useState(course.name);

  function toggleSection(i: number) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function toggleLesson(key: string) {
    setExpandedLessons((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleCourseNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCourseName(e.target.value);
    onChange({ ...course, name: e.target.value });
  }

  function handleBlockSave(
    sectionIdx: number,
    lessonIdx: number,
    blockIdx: number,
    updated: ContentBlock
  ) {
    const newCourse = JSON.parse(JSON.stringify(course)) as CourseStructure;
    newCourse.sections[sectionIdx].lessons[lessonIdx].blocks[blockIdx] = updated;
    onChange(newCourse);
  }

  const totalLessons = course.sections.reduce(
    (sum, s) => sum + s.lessons.length,
    0
  );
  const totalBlocks = course.sections.reduce(
    (sum, s) =>
      sum + s.lessons.reduce((ls, l) => ls + l.blocks.length, 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0 space-y-1">
          <Label htmlFor="course-name">Course Name</Label>
          <Input
            id="course-name"
            value={courseName}
            onChange={handleCourseNameChange}
            className="text-lg font-semibold"
          />
          <p className="text-xs text-black/50">
            Slug: <code className="font-mono">{course.slug}</code>
          </p>
        </div>
        <div className="flex gap-4 text-sm text-black/60 shrink-0 pt-6">
          <span className="flex items-center gap-1">
            <Layers className="h-4 w-4" />
            {course.sections.length} sections
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="h-4 w-4" />
            {totalLessons} lessons
          </span>
          <span>{totalBlocks} blocks</span>
        </div>
      </div>

      <div className="space-y-2">
        {course.sections.map((section, si) => (
          <Card key={si} className="overflow-hidden">
            <button
              onClick={() => toggleSection(si)}
              className="flex w-full items-center gap-3 p-4 text-left hover:bg-black/5 transition-colors"
            >
              {expandedSections.has(si) ? (
                <ChevronDown className="h-4 w-4 shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0" />
              )}
              <span className="font-medium flex-1">{section.name}</span>
              <Badge variant="secondary">{section.lessons.length} lessons</Badge>
            </button>
            {expandedSections.has(si) && (
              <div className="border-t border-black/10">
                {section.lessons.map((lesson, li) => {
                  const key = `${si}-${li}`;
                  return (
                    <div key={li} className="border-b border-black/5 last:border-0">
                      <button
                        onClick={() => toggleLesson(key)}
                        className="flex w-full items-center gap-3 px-6 py-3 text-left hover:bg-black/5 transition-colors"
                      >
                        {expandedLessons.has(key) ? (
                          <ChevronDown className="h-3 w-3 shrink-0" />
                        ) : (
                          <ChevronRight className="h-3 w-3 shrink-0" />
                        )}
                        <span className="text-sm font-medium flex-1">
                          {lesson.name}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {lesson.blocks.length} blocks
                        </Badge>
                      </button>
                      {expandedLessons.has(key) && (
                        <div className="px-6 pb-3 space-y-1.5">
                          {lesson.blocks.map((block, bi) => (
                            <div
                              key={bi}
                              className="flex items-start gap-2 rounded-md border border-black/5 bg-white p-2.5"
                            >
                              <span
                                className={[
                                  "shrink-0 rounded px-1.5 py-0.5 text-xs font-mono",
                                  BLOCK_TYPE_COLORS[block.type] ?? "bg-gray-100",
                                ].join(" ")}
                              >
                                {block.type}
                              </span>
                              <span className="text-xs text-black/60 flex-1 truncate">
                                {blockSummary(block)}
                              </span>
                              <button
                                onClick={() =>
                                  setEditingBlock({
                                    sectionIdx: si,
                                    lessonIdx: li,
                                    blockIdx: bi,
                                    block,
                                  })
                                }
                                className="shrink-0 text-black/30 hover:text-black transition-colors"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        ))}
      </div>

      <Button onClick={onNext} className="w-full" size="lg">
        Looks good! ✓
        <ArrowRight className="h-4 w-4" />
      </Button>

      {editingBlock && (
        <EditModal
          block={editingBlock.block}
          onSave={(updated) =>
            handleBlockSave(
              editingBlock.sectionIdx,
              editingBlock.lessonIdx,
              editingBlock.blockIdx,
              updated
            )
          }
          onClose={() => setEditingBlock(null)}
        />
      )}
    </div>
  );
}
