import { describe, it, expect, vi } from "vitest";
import { createSSEStream, consumeSSE, sseResponse } from "@/lib/sse";

describe("createSSEStream + sseResponse", () => {
  it("sends JSON-encoded SSE events", async () => {
    const { stream, send, close } = createSSEStream();
    send({ type: "progress", message: "hello" });
    send({ type: "complete", data: 42 });
    close();

    const response = sseResponse(stream);
    const text = await response.text();
    expect(text).toContain('data: {"type":"progress","message":"hello"}');
    expect(text).toContain('data: {"type":"complete","data":42}');
  });

  it("sseResponse sets correct headers", () => {
    const { stream } = createSSEStream();
    const response = sseResponse(stream);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
  });
});

describe("consumeSSE", () => {
  function makeResponse(events: object[]): Response {
    const { stream, send, close } = createSSEStream();
    for (const e of events) send(e);
    close();
    return sseResponse(stream);
  }

  it("routes progress events to onProgress", async () => {
    const onProgress = vi.fn();
    const res = makeResponse([{ type: "progress", message: "step 1" }]);
    await consumeSSE(res, { onProgress });
    expect(onProgress).toHaveBeenCalledWith("step 1", expect.objectContaining({ type: "progress" }));
  });

  it("routes complete events to onComplete", async () => {
    const onComplete = vi.fn();
    const res = makeResponse([{ type: "complete", log: { id: 1 } }]);
    const got = await consumeSSE(res, { onComplete });
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ type: "complete", log: { id: 1 } }));
    expect(got).toBe(true);
  });

  it("routes error events to onError", async () => {
    const onError = vi.fn();
    const res = makeResponse([{ type: "error", message: "failed" }]);
    const got = await consumeSSE(res, { onError });
    expect(onError).toHaveBeenCalledWith("failed", expect.objectContaining({ type: "error" }));
    expect(got).toBe(true);
  });

  it("routes ping events to onPing", async () => {
    const onPing = vi.fn();
    const res = makeResponse([{ type: "ping" }]);
    await consumeSSE(res, { onPing });
    expect(onPing).toHaveBeenCalledOnce();
  });

  it("returns false when stream closes without result", async () => {
    const res = makeResponse([{ type: "progress", message: "only progress" }]);
    const got = await consumeSSE(res, {});
    expect(got).toBe(false);
  });

  it("skips malformed JSON lines without throwing", async () => {
    // Manually create a stream with bad data
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(enc.encode("data: not-json\n\n"));
        controller.enqueue(enc.encode('data: {"type":"complete","ok":true}\n\n'));
        controller.close();
      },
    });
    const res = new Response(stream, { headers: { "Content-Type": "text/event-stream" } });

    const onComplete = vi.fn();
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const got = await consumeSSE(res, { onComplete });

    expect(consoleSpy).toHaveBeenCalled(); // warns about parse error
    expect(onComplete).toHaveBeenCalledOnce();
    expect(got).toBe(true);
    consoleSpy.mockRestore();
  });

  it("handles data split across chunks", async () => {
    const enc = new TextEncoder();
    const fullLine = 'data: {"type":"complete","value":1}\n\n';
    // Split in the middle
    const part1 = fullLine.slice(0, 15);
    const part2 = fullLine.slice(15);

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(enc.encode(part1));
        controller.enqueue(enc.encode(part2));
        controller.close();
      },
    });
    const res = new Response(stream, { headers: { "Content-Type": "text/event-stream" } });

    const onComplete = vi.fn();
    const got = await consumeSSE(res, { onComplete });
    expect(onComplete).toHaveBeenCalledOnce();
    expect(got).toBe(true);
  });

  it("throws if response has no body", async () => {
    const res = new Response(null);
    await expect(consumeSSE(res, {})).rejects.toThrow("No response stream");
  });

  it("handles multiple events in sequence", async () => {
    const onProgress = vi.fn();
    const onComplete = vi.fn();
    const res = makeResponse([
      { type: "progress", message: "step 1" },
      { type: "progress", message: "step 2" },
      { type: "complete", done: true },
    ]);
    await consumeSSE(res, { onProgress, onComplete });
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
