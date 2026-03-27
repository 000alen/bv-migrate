// ─── Server-side SSE helpers ──────────────────────────────────────────────────

/**
 * Create an SSE ReadableStream with send/close helpers.
 * Usage in API routes:
 *   const { stream, send, close } = createSSEStream();
 *   void (async () => { ... send(...); ... })().finally(() => close());
 *   return sseResponse(stream);
 */
export function createSSEStream(): {
  stream: ReadableStream;
  send: (data: object) => void;
  close: () => void;
} {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  const enc = new TextEncoder();
  return {
    stream,
    send(data: object) {
      controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
    },
    close() {
      controller.close();
    },
  };
}

export function sseResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ─── Client-side SSE helpers ──────────────────────────────────────────────────

export interface SSEHandlers {
  onProgress?: (message: string, raw: Record<string, unknown>) => void;
  onComplete?: (data: Record<string, unknown>) => void;
  onError?: (message: string, raw: Record<string, unknown>) => void;
  onPing?: () => void;
}

/**
 * Consume an SSE response stream, routing events to handlers.
 * Returns true if a "complete" or "error" event was received before stream end.
 */
export async function consumeSSE(
  response: Response,
  handlers: SSEHandlers
): Promise<boolean> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response stream");

  const dec = new TextDecoder();
  let buf = "";
  let gotResult = false;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
        switch (data.type) {
          case "progress":
            handlers.onProgress?.(String(data.message ?? ""), data);
            break;
          case "complete":
            gotResult = true;
            handlers.onComplete?.(data);
            break;
          case "error":
            gotResult = true;
            handlers.onError?.(
              String(data.message ?? "Unknown error"),
              data
            );
            break;
          case "ping":
            handlers.onPing?.();
            break;
        }
      } catch (e) {
        console.warn("SSE parse error:", e);
      }
    }
  }

  return gotResult;
}
