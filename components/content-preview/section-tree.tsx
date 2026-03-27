"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { type CourseStructure, type ContentBlock } from "@/lib/schema";
import { ChevronDown, ChevronRight, Edit2 } from "lucide-react";
import { BlockBadge } from "./block-badge";

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

interface SectionTreeProps {
  course: CourseStructure;
  onEditBlock: (
    sectionIdx: number,
    lessonIdx: number,
    blockIdx: number,
    block: ContentBlock
  ) => void;
}

export function SectionTree({ course, onEditBlock }: SectionTreeProps) {
  const [expandedSections, setExpandedSections] = React.useState<Set<number>>(
    new Set([0])
  );
  const [expandedLessons, setExpandedLessons] = React.useState<Set<string>>(
    new Set()
  );

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

  return (
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
                            <BlockBadge type={block.type} />
                            <span className="text-xs text-black/60 flex-1 truncate">
                              {blockSummary(block)}
                            </span>
                            <button
                              onClick={() => onEditBlock(si, li, bi, block)}
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
  );
}
