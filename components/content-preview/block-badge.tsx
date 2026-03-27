export const BLOCK_TYPE_COLORS: Record<string, string> = {
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

export function BlockBadge({ type }: { type: string }) {
  return (
    <span
      className={[
        "shrink-0 rounded px-1.5 py-0.5 text-xs font-mono",
        BLOCK_TYPE_COLORS[type] ?? "bg-gray-100",
      ].join(" ")}
    >
      {type}
    </span>
  );
}
