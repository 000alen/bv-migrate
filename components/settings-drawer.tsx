"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { LlmProvider } from "@/hooks/use-wizard-state";

interface SettingsDrawerProps {
  open: boolean;
  circleToken: string;
  anthropicKey: string;
  llmProvider: LlmProvider;
  cerebrasKey: string;
  spaceGroupId: string;
  onClose: () => void;
  onCircleToken: (v: string) => void;
  onAnthropicKey: (v: string) => void;
  onLlmProvider: (v: LlmProvider) => void;
  onCerebrasKey: (v: string) => void;
  onSpaceGroupId: (v: string) => void;
}

export function SettingsDrawer({
  open,
  circleToken,
  anthropicKey,
  llmProvider,
  cerebrasKey,
  spaceGroupId,
  onClose,
  onCircleToken,
  onAnthropicKey,
  onLlmProvider,
  onCerebrasKey,
  onSpaceGroupId,
}: SettingsDrawerProps) {
  const [saved, setSaved] = useState(false);

  function handleSave() {
    localStorage.setItem("bv_circle_token", circleToken);
    localStorage.setItem("bv_anthropic_key", anthropicKey);
    localStorage.setItem("bv_llm_provider", llmProvider);
    localStorage.setItem("bv_cerebras_key", cerebrasKey);
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
          aria-label="Settings"
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

          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <DialogPrimitive.Description className="text-xs text-gray-500">
              Keys stay in your browser. PDF extraction runs on this app and calls Cerebras or
              Anthropic — not a separate analytics service.
            </DialogPrimitive.Description>

            <div className="space-y-1.5">
              <label
                htmlFor="llm-provider"
                className="block text-sm font-medium text-black"
              >
                PDF extraction LLM
              </label>
              <select
                id="llm-provider"
                value={llmProvider}
                onChange={(e) => onLlmProvider(e.target.value as LlmProvider)}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple bg-white"
              >
                <option value="cerebras">Cerebras (default — fast, local PDF text)</option>
                <option value="anthropic">Anthropic (Claude — optional native PDF)</option>
              </select>
              <p id="llm-provider-hint" className="text-xs text-gray-500">
                Default: PDF text is extracted in the app, then sent to Cerebras for JSON. Use
                Anthropic if you need native PDF mode (e.g. scanned pages).
              </p>
            </div>

            {llmProvider === "anthropic" ? (
              <Field
                label="Anthropic API Key"
                id="anthropic-key"
                value={anthropicKey}
                onChange={onAnthropicKey}
                placeholder="sk-ant-..."
                hint="Used to structure course content from your PDF."
                autoFocus
              />
            ) : (
              <Field
                label="Cerebras API Key"
                id="cerebras-key"
                value={cerebrasKey}
                onChange={onCerebrasKey}
                placeholder="csk-..."
                hint="From Cerebras Cloud. Used with local PDF text extraction."
                autoFocus
              />
            )}

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
              className={`w-full h-10 rounded-lg font-medium text-sm transition-colors ${saved ? "bg-green-500" : "bg-brand-purple"}`}
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
  autoFocus,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hint: string;
  autoFocus?: boolean;
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
        autoFocus={autoFocus}
        aria-describedby={`${id}-hint`}
        className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple bg-white"
      />
      <p id={`${id}-hint`} className="text-xs text-gray-500">{hint}</p>
    </div>
  );
}
