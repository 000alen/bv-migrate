"use client";

interface BobMessageProps {
  message: string;
  subtext?: string;
}

export function BobMessage({ message, subtext }: BobMessageProps) {
  return (
    <div className="flex items-start gap-3 max-w-xl animate-fade-in">
      <div
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xl select-none"
        style={{ backgroundColor: "#CE99F2" }}
      >
        👷
      </div>
      <div
        className="rounded-2xl rounded-tl-none px-4 py-3 shadow-sm"
        style={{ backgroundColor: "#F5F6F1" }}
      >
        <p className="text-sm text-black leading-relaxed">{message}</p>
        {subtext && (
          <p className="text-xs mt-1" style={{ color: "#666" }}>
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}
