"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { type CourseStructure, type ContentBlock } from "@/lib/schema";
import { ArrowRight, BookOpen, Layers } from "lucide-react";
import { BlockEditor } from "./block-editor";
import { SectionTree } from "./section-tree";

interface ContentPreviewProps {
  course: CourseStructure;
  onChange: (updated: CourseStructure) => void;
  onNext: () => void;
}

export function ContentPreview({ course, onChange, onNext }: ContentPreviewProps) {
  const [editingBlock, setEditingBlock] = React.useState<{
    sectionIdx: number;
    lessonIdx: number;
    blockIdx: number;
    block: ContentBlock;
  } | null>(null);
  const [courseName, setCourseName] = React.useState(course.name);

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

  const totalLessons = course.sections.reduce((sum, s) => sum + s.lessons.length, 0);
  const totalBlocks = course.sections.reduce(
    (sum, s) => sum + s.lessons.reduce((ls, l) => ls + l.blocks.length, 0),
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

      <SectionTree
        course={course}
        onEditBlock={(si, li, bi, block) =>
          setEditingBlock({ sectionIdx: si, lessonIdx: li, blockIdx: bi, block })
        }
      />

      <Button onClick={onNext} className="w-full" size="lg">
        Looks good! ✓
        <ArrowRight className="h-4 w-4" />
      </Button>

      {editingBlock && (
        <BlockEditor
          block={editingBlock.block}
          onSave={(updated) => {
            handleBlockSave(
              editingBlock.sectionIdx,
              editingBlock.lessonIdx,
              editingBlock.blockIdx,
              updated
            );
            setEditingBlock(null);
          }}
          onClose={() => setEditingBlock(null)}
        />
      )}
    </div>
  );
}
