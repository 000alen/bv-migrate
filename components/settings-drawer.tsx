"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

interface SettingsDrawerProps {
  open: boolean;
  circleToken: string;
  anthropicKey: string;
  spaceGroupId: string;
  onClose: () => void;
  onCircleToken: (v: string) => void;
  onAnthropicKey: (v: string) => void;
  onSpaceGroupId: (v: string) => void;
}

export function SettingsDrawer({
  open,
  circleToken,
  anthropicKey,
  spaceGroupId,
  onClose,
  onCircleToken,
  onAnthropicKey,
  onSpaceGroupId,
}: SettingsDrawerProps) {
  const [saved, setSaved] = useState(false);

  function handleSave() {
    localStorage.setItem("bv_circle_token", circleToken);
    localStorage.setItem("bv_anthropic_key", anthropicKey);
    localStorage.setItem("bv_space_group_id", spaceGroupId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  useEffect(() => {
    if (!open) setSaved(false);
  }, [open]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col animate-slide-in-right"
          aria-describedby="settings-desc"
        >
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <DialogPrimitive.Title className="font-semibold text-base">
              ⚙️ Settings
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close settings"
              >
                <X className="h-4 w-4" />
              </button>
            </DialogPrimitive.Close>
          </div>

          <div id="settings-desc" className="flex-1 overflow-y-auto p-6 space-y-5">
            <p className="text-xs text-gray-500">
              Keys are stored in your browser only — never sent to any server other than the
              respective APIs.
            </p>

            <Field
              label="Anthropic API Key"
              id="anthropic-key"
              value={anthropicKey}
              onChange={onAnthropicKey}
              placeholder="sk-ant-..."
              hint="Used to extract course content from your PDF."
            />

            <Field
              label="Circle API Token"
              id="circle-token"
              value={circleToken}
              onChange={onCircleToken}
              placeholder="eyJ..."
              hint='Found in Circle → Settings → API. Use "Token" auth (not Bearer).'
            />

            <Field
              label="Space Group ID"
              id="space-group-id"
              value={spaceGroupId}
              onChange={onSpaceGroupId}
              placeholder="12345"
              hint="The numeric ID of the Space Group to import courses into."
            />
          </div>

          <div className="p-6 border-t border-gray-100">
            <button
              onClick={handleSave}
              className="w-full h-10 rounded-lg font-medium text-sm transition-colors"
              style={{
                backgroundColor: saved ? "#22c55e" : "#CE99F2",
                color: "#000",
              }}
            >
              {saved ? "Saved ✓" : "Save"}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hint: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-black">
        {label}
      </label>
      <input
        id={id}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#CE99F2] bg-white"
      />
      <p className="text-xs text-gray-500">{hint}</p>
    </div>
  );
}
