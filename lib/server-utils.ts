/**
 * Server-only utilities. These use Node.js APIs (crypto) and must NOT
 * be imported from client components.
 */
import crypto from "node:crypto";

export function md5Base64(buf: Buffer): string {
  return crypto.createHash("md5").update(buf).digest("base64");
}

export function parseDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { contentType: match[1], buffer: Buffer.from(match[2], "base64") };
}
