import { createAnthropic } from "@ai-sdk/anthropic";
import { createCerebras } from "@ai-sdk/cerebras";
import type { generateText } from "ai";
import type { NextRequest } from "next/server";

/** Model handle accepted by `generateText` (Anthropic + Cerebras providers). */
type ExtractTextModel = Parameters<typeof generateText>[0]["model"];

export type ExtractLlmProviderName = "anthropic" | "cerebras";

export type ResolvedExtractLlm =
  | {
      ok: true;
      provider: ExtractLlmProviderName;
      modelId: string;
      /** Reuse for multiple generateText calls (main + repair). */
      model: ExtractTextModel;
    }
  | { ok: false; message: string };

/**
 * Resolves extraction backend. Default is Cerebras (`BV_EXTRACTION_LLM` or no config).
 *
 * Priority: `x-llm-provider` → `BV_EXTRACTION_LLM` → infer from keys
 * (`x-anthropic-key` only → Anthropic; `x-cerebras-key` / `CEREBRAS_API_KEY` only → Cerebras;
 * both → Cerebras) → default **cerebras**.
 *
 * Keys: `x-anthropic-key`; Cerebras `x-cerebras-key` or `CEREBRAS_API_KEY` env.
 * Models: `x-model` → `BV_CEREBRAS_MODEL` / `BV_EXTRACTION_MODEL` → provider defaults.
 */
function resolveExtractProvider(req: NextRequest): ExtractLlmProviderName {
  const explicit = req.headers.get("x-llm-provider")?.trim().toLowerCase();
  if (explicit === "anthropic" || explicit === "cerebras") return explicit;

  const envDefault = process.env.BV_EXTRACTION_LLM?.trim().toLowerCase();
  if (envDefault === "anthropic" || envDefault === "cerebras") return envDefault;

  const anth = req.headers.get("x-anthropic-key")?.trim();
  const cer =
    req.headers.get("x-cerebras-key")?.trim() ??
    process.env.CEREBRAS_API_KEY?.trim() ??
    "";

  if (anth && !cer) return "anthropic";
  if (cer && !anth) return "cerebras";
  if (anth && cer) return "cerebras";
  return "cerebras";
}

export function resolveExtractLlm(req: NextRequest): ResolvedExtractLlm {
  const raw = resolveExtractProvider(req);

  if (raw === "cerebras") {
    const apiKey =
      req.headers.get("x-cerebras-key")?.trim() ??
      process.env.CEREBRAS_API_KEY?.trim() ??
      "";
    if (!apiKey) {
      return {
        ok: false,
        message:
          "Cerebras requires x-cerebras-key header or CEREBRAS_API_KEY environment variable.",
      };
    }
    const modelId =
      req.headers.get("x-model")?.trim() ??
      process.env.BV_CEREBRAS_MODEL?.trim() ??
      "gpt-oss-120b";
    const cerebras = createCerebras({ apiKey });
    return {
      ok: true,
      provider: "cerebras",
      modelId,
      model: cerebras(modelId) as unknown as ExtractTextModel,
    };
  }

  const apiKey = req.headers.get("x-anthropic-key")?.trim() ?? "";
  if (!apiKey) {
    return { ok: false, message: "Missing x-anthropic-key header" };
  }
  const modelId =
    req.headers.get("x-model")?.trim() ??
    process.env.BV_EXTRACTION_MODEL?.trim() ??
    "claude-haiku-4-5";
  const anthropic = createAnthropic({ apiKey });
  return {
    ok: true,
    provider: "anthropic",
    modelId,
    model: anthropic(modelId) as unknown as ExtractTextModel,
  };
}
