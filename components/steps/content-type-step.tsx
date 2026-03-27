"use client";

import type { ContentType } from "@/lib/types";

interface ContentTypeStepProps {
  onSelect: (ct: ContentType) => void;
}

const OPTIONS: { value: ContentType; label: string; emoji: string }[] = [
  { value: "module", label: "Module", emoji: "📦" },
  { value: "milestone", label: "Milestone", emoji: "🏆" },
  { value: "micromodule", label: "Micromodule", emoji: "🔬" },
];

export function ContentTypeStep({ onSelect }: ContentTypeStepProps) {
  return (
    <div className="animate-fade-in rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap gap-3">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full border-2 border-gray-200 text-sm font-medium hover:border-brand-purple hover:bg-brand-purple/10 transition-all"
          >
            <span>{opt.emoji}</span>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
