/**
 * Utilities for consuming SSE streams in integration tests.
 */

/**
 * Read the entire response body and return all parsed SSE data events
 * as an array of plain objects.
 */
export async function collectSSEEvents(
  response: Response
): Promise<Array<Record<string, unknown>>> {
  const events: Array<Record<string, unknown>> = [];
  const reader = response.body?.getReader();
  if (!reader) throw new Error("collectSSEEvents: response has no body");

  const dec = new TextDecoder();
  let buf = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        events.push(JSON.parse(line.slice(6)) as Record<string, unknown>);
      } catch {
        // skip malformed lines
      }
    }
  }

  return events;
}

/**
 * Find the first event with the given type. Returns undefined if not found.
 */
export function findEvent(
  events: Array<Record<string, unknown>>,
  type: string
): Record<string, unknown> | undefined {
  return events.find((e) => e.type === type);
}

/**
 * Filter events by type.
 */
export function filterEvents(
  events: Array<Record<string, unknown>>,
  type: string
): Array<Record<string, unknown>> {
  return events.filter((e) => e.type === type);
}
