import { describe, it, expect } from "vitest";
import { extractBalancedJsonObject } from "@/lib/extract-json";

describe("extractBalancedJsonObject", () => {
  it("extracts object from preamble text", () => {
    const inner = `{"a":1,"b":"hello \"world\""}`;
    const text = `Here is the JSON:\n${inner}\ntrailing`;
    expect(extractBalancedJsonObject(text)).toBe(inner);
  });

  it("returns null when braces never balance", () => {
    expect(extractBalancedJsonObject('{"a":')).toBeNull();
  });
});
