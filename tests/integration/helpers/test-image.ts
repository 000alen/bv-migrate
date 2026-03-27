/**
 * Generate a minimal valid PNG image for integration testing.
 *
 * Creates a 2x2 red pixel PNG — structurally valid, tiny (< 100 bytes).
 * Returns both a Buffer and a base64 data URL.
 */

import crypto from "node:crypto";

function crc32(buf: Buffer): number {
  // CRC-32 per PNG spec (ISO 3309 / ITU-T V.42)
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, checksum]);
}

export function makeTestPng(): Buffer {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR: 2x2 pixels, 8-bit RGB (color type 2), no interlace
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(2, 0);  // width
  ihdrData.writeUInt32BE(2, 4);  // height
  ihdrData[8] = 8;               // bit depth
  ihdrData[9] = 2;               // color type (RGB)
  ihdrData[10] = 0;              // compression
  ihdrData[11] = 0;              // filter
  ihdrData[12] = 0;              // interlace
  const ihdr = pngChunk("IHDR", ihdrData);

  // IDAT: raw image data (filter byte + 3 bytes RGB per pixel, 2 rows)
  // Row 1: filter=0, red, red   → [0, 255, 0, 0, 255, 0, 0]
  // Row 2: filter=0, red, red   → [0, 255, 0, 0, 255, 0, 0]
  const rawRows = Buffer.from([
    0, 255, 0, 0, 255, 0, 0,
    0, 255, 0, 0, 255, 0, 0,
  ]);
  // Deflate-compress the raw data using zlib
  const { deflateSync } = require("node:zlib") as typeof import("node:zlib");
  const compressed = deflateSync(rawRows);
  const idat = pngChunk("IDAT", compressed);

  // IEND
  const iend = pngChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

export const TEST_PNG: Buffer = makeTestPng();

/**
 * Returns a base64 data URL for the test PNG.
 */
export function testPngDataUrl(): string {
  return `data:image/png;base64,${TEST_PNG.toString("base64")}`;
}

/**
 * MD5 checksum in base64 (required by Circle's direct_uploads API).
 */
export function md5Base64(buf: Buffer): string {
  return crypto.createHash("md5").update(buf).digest("base64");
}
