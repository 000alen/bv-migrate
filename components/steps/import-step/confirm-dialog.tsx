interface ConfirmDialogProps {
  sectionCount: number;
  lessonCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  sectionCount,
  lessonCount,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 space-y-4 m-4">
        <h3 className="font-semibold text-base">Ready to import?</h3>
        <p className="text-sm text-gray-600">
          This will create a new course in Circle with{" "}
          <strong>{sectionCount} section{sectionCount !== 1 ? "s" : ""}</strong> and{" "}
          <strong>{lessonCount} lesson{lessonCount !== 1 ? "s" : ""}</strong>. All content
          will be in draft mode. This cannot be easily undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-brand-purple"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
