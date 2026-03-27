"use client";

import type { CourseStructure } from "@/lib/schema";

interface GeniallyStepProps {
  course: CourseStructure;
  urls: Record<string, string>;
  onUrlsChange: (urls: Record<string, string>) => void;
  onConfirm: () => void;
}

interface GeniallyPlaceholder {
  name: string;
  description: string;
  section: string;
  lesson: string;
}

function collectGenially(course: CourseStructure): GeniallyPlaceholder[] {
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
            section: section.name,
            lesson: lesson.name,
          });
        }
      }
    }
  }
  return result;
}

export function GeniallyStep({ course, urls, onUrlsChange, onConfirm }: GeniallyStepProps) {
  const placeholders = collectGenially(course);

  function setUrl(name: string, url: string) {
    onUrlsChange({ ...urls, [name]: url });
  }

  if (placeholders.length === 0) {
    return (
      <div className="animate-fade-in rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-gray-500">No Genially interactives found.</p>
        <button
          onClick={onConfirm}
          className="mt-3 h-9 px-4 rounded-lg text-sm font-medium bg-[#CE99F2] hover:bg-[#b87de0] transition-colors"
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      <div className="space-y-3">
        {placeholders.map((p) => (
          <div key={p.name} className="space-y-1">
            <label className="block text-xs font-medium text-black">
              {p.name}
            </label>
            <p className="text-xs text-gray-500">{p.description}</p>
            <input
              type="url"
              value={urls[p.name] ?? ""}
              onChange={(e) => setUrl(p.name, e.target.value)}
              placeholder="https://view.genially.com/..."
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#CE99F2]"
            />
          </div>
        ))}
      </div>

      <button
        onClick={onConfirm}
        className="w-full h-10 rounded-lg text-sm font-medium transition-colors"
        style={{ backgroundColor: "#CE99F2" }}
      >
        Ready to build! 🏗️
      </button>
    </div>
  );
}
