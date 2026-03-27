"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type ContentBlock, ContentBlockSchema } from "@/lib/schema";
import { X, Check } from "lucide-react";

function formatZodIssues(
  issues: { path: (string | number)[]; message: string }[]
): string {
  return issues
    .map((i) => {
      const p = i.path.join(".");
      return p ? `${p}: ${i.message}` : i.message;
    })
    .join("\n");
}

function ModalFooter({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex gap-2 justify-end pt-2">
      <Button variant="secondary" onClick={onClose}>
        Cancel
      </Button>
      <Button onClick={onSave}>
        <Check className="h-4 w-4" />
        Save
      </Button>
    </div>
  );
}

function TextBlockForm({
  block,
  onSave,
  onClose,
}: {
  block: Extract<ContentBlock, { type: "text" }>;
  onSave: (b: ContentBlock) => void;
  onClose: () => void;
}) {
  const [html, setHtml] = React.useState(block.html);
  const [err, setErr] = React.useState<string | null>(null);

  function handleSave() {
    const result = ContentBlockSchema.safeParse({ type: "text", html });
    if (!result.success) {
      setErr(formatZodIssues(result.error.issues));
      return;
    }
    setErr(null);
    onSave(result.data);
    onClose();
  }

  return (
    <>
      <Label htmlFor="text-html" className="text-sm font-medium">
        HTML Content
      </Label>
      <Textarea
        id="text-html"
        value={html}
        onChange={(e) => setHtml(e.target.value)}
        className="font-mono text-xs min-h-[260px]"
      />
      {err && <pre className="text-xs text-red-600 whitespace-pre-wrap">{err}</pre>}
      <ModalFooter onClose={onClose} onSave={handleSave} />
    </>
  );
}

function QuizBlockForm({
  block,
  onSave,
  onClose,
}: {
  block: Extract<ContentBlock, { type: "quiz" }>;
  onSave: (b: ContentBlock) => void;
  onClose: () => void;
}) {
  const [question, setQuestion] = React.useState(block.question);
  const [options, setOptions] = React.useState<string[]>(block.options);
  const [correctIndex, setCorrectIndex] = React.useState(block.correctIndex);
  const [feedbackCorrect, setFeedbackCorrect] = React.useState(block.feedbackCorrect);
  const [feedbackIncorrect, setFeedbackIncorrect] = React.useState(block.feedbackIncorrect);
  const [err, setErr] = React.useState<string | null>(null);

  function handleSave() {
    const result = ContentBlockSchema.safeParse({
      type: "quiz",
      question,
      options,
      correctIndex,
      feedbackCorrect,
      feedbackIncorrect,
    });
    if (!result.success) {
      setErr(formatZodIssues(result.error.issues));
      return;
    }
    setErr(null);
    onSave(result.data);
    onClose();
  }

  return (
    <div className="space-y-3 overflow-y-auto max-h-[440px] pr-1">
      <div className="space-y-1">
        <Label>Question</Label>
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>Options</Label>
        {options.map((opt, i) => (
          <Input
            key={i}
            value={opt}
            placeholder={`Option ${i + 1}`}
            onChange={(e) => {
              const n = [...options];
              n[i] = e.target.value;
              setOptions(n);
            }}
          />
        ))}
      </div>
      <div className="space-y-1">
        <Label htmlFor="correct-idx">Correct Answer</Label>
        <select
          id="correct-idx"
          value={correctIndex}
          onChange={(e) => setCorrectIndex(Number(e.target.value))}
          className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#CE99F2] bg-white"
        >
          {options.map((opt, i) => (
            <option key={i} value={i}>
              {i + 1}. {opt || `(option ${i + 1})`}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label>Feedback — Correct</Label>
        <Textarea
          value={feedbackCorrect}
          onChange={(e) => setFeedbackCorrect(e.target.value)}
          className="text-xs min-h-[60px]"
        />
      </div>
      <div className="space-y-1">
        <Label>Feedback — Incorrect</Label>
        <Textarea
          value={feedbackIncorrect}
          onChange={(e) => setFeedbackIncorrect(e.target.value)}
          className="text-xs min-h-[60px]"
        />
      </div>
      {err && <pre className="text-xs text-red-600 whitespace-pre-wrap">{err}</pre>}
      <ModalFooter onClose={onClose} onSave={handleSave} />
    </div>
  );
}

function JsonBlockForm({
  block,
  onSave,
  onClose,
}: {
  block: ContentBlock;
  onSave: (b: ContentBlock) => void;
  onClose: () => void;
}) {
  const [json, setJson] = React.useState(JSON.stringify(block, null, 2));
  const [err, setErr] = React.useState<string | null>(null);

  function handleSave() {
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch (e) {
      setErr(`JSON syntax error: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    const result = ContentBlockSchema.safeParse(raw);
    if (!result.success) {
      setErr(formatZodIssues(result.error.issues));
      return;
    }
    setErr(null);
    onSave(result.data);
    onClose();
  }

  return (
    <>
      <Textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        className="font-mono text-xs min-h-[300px]"
      />
      {err && <pre className="text-xs text-red-600 whitespace-pre-wrap">{err}</pre>}
      <ModalFooter onClose={onClose} onSave={handleSave} />
    </>
  );
}

interface BlockEditorProps {
  block: ContentBlock;
  onSave: (updated: ContentBlock) => void;
  onClose: () => void;
}

export function BlockEditor({ block, onSave, onClose }: BlockEditorProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl p-6 space-y-4 m-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Edit Block ({block.type})</h3>
          <button onClick={onClose} className="text-black/40 hover:text-black">
            <X className="h-5 w-5" />
          </button>
        </div>
        {block.type === "text" ? (
          <TextBlockForm block={block} onSave={onSave} onClose={onClose} />
        ) : block.type === "quiz" ? (
          <QuizBlockForm block={block} onSave={onSave} onClose={onClose} />
        ) : (
          <JsonBlockForm block={block} onSave={onSave} onClose={onClose} />
        )}
      </div>
    </div>
  );
}
