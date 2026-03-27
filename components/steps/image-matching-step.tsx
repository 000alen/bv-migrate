"use client";

import type { CourseStructure } from "@/lib/schema";
import type { ZipImage } from "@/lib/types";
import { collectBlocks } from "@/lib/utils";

interface ImageMatchingStepProps {
  course: CourseStructure;
  zipImages: ZipImage[];
  assignments: Record<number, string>;
  onAssignmentsChange: (assignments: Record<number, string>) => void;
  onConfirm: () => void;
}

export function ImageMatchingStep({
  course,
  zipImages,
  assignments,
  onAssignmentsChange,
  onConfirm,
}: ImageMatchingStepProps) {
  const placeholders = collectBlocks(course, "image_placeholder").map(({ block, section, lesson }) => ({
    index: block.index,
    description: block.description,
    section,
    lesson,
  }));

  function assign(index: number, imageName: string) {
    onAssignmentsChange({ ...assignments, [index]: imageName });
  }

  const allAssigned = placeholders.every((p) => assignments[p.index]);

  if (placeholders.length === 0) {
    return (
      <div className="animate-fade-in rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-gray-500">No image placeholders found.</p>
        <button
          onClick={onConfirm}
          className="mt-3 h-9 px-4 rounded-lg text-sm font-medium bg-brand-purple hover:bg-[#b87de0] transition-colors"
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      <p className="text-xs text-gray-500">
        {Object.keys(assignments).length} of {placeholders.length} matched
      </p>

      <div className="space-y-3">
        {placeholders.map((p) => {
          const selectedImage = zipImages.find((img) => img.name === assignments[p.index]);
          return (
            <div key={p.index} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-black truncate">
                  #{p.index}: {p.description}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {p.section} → {p.lesson}
                </p>
                <select
                  value={assignments[p.index] ?? ""}
                  onChange={(e) => assign(p.index, e.target.value)}
                  className="mt-1.5 w-full text-xs rounded-md border border-gray-200 bg-white px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-purple"
                >
                  <option value="">Select image…</option>
                  {zipImages.map((img) => (
                    <option key={img.name} value={img.name}>
                      {img.name}
                    </option>
                  ))}
                </select>
              </div>
              {selectedImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedImage.dataUrl}
                  alt={selectedImage.name}
                  className="w-14 h-14 rounded-md object-cover flex-shrink-0 border border-gray-200"
                />
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={onConfirm}
        disabled={!allAssigned}
        className="w-full h-10 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 bg-brand-purple"
      >
        {allAssigned ? "All matched! ✓" : `${Object.keys(assignments).length}/${placeholders.length} matched — assign all to continue`}
      </button>
    </div>
  );
}
