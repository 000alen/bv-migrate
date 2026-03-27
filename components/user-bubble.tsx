"use client";

interface UserBubbleProps {
  children: React.ReactNode;
}

export function UserBubble({ children }: UserBubbleProps) {
  return (
    <div className="flex justify-end animate-fade-in">
      <div
        className="rounded-2xl rounded-tr-none px-4 py-3 text-sm text-black shadow-sm max-w-xs"
        style={{ backgroundColor: "#CE99F2" }}
      >
        {children}
      </div>
    </div>
  );
}
