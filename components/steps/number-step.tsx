"use client";

interface NumberStepProps {
  max: number;
  onSelect: (n: number) => void;
}

export function NumberStep({ max, onSelect }: NumberStepProps) {
  return (
    <div className="animate-fade-in rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => onSelect(n)}
            className="w-12 h-12 rounded-xl border-2 border-gray-200 text-sm font-semibold hover:border-brand-purple hover:bg-brand-purple/10 transition-all"
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
