import { NextRequest } from "next/server";
import { createSSEStream, sseResponse } from "@/lib/sse";
import { parseRiseExport } from "@/lib/rise-parser";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { stream, send, close } = createSSEStream();

  void (async () => {
    try {
      const formData = await req.formData();
      const zipFile = formData.get("zip") as File | null;
      if (!zipFile) {
        send({ type: "error", message: "Missing zip file in form data" });
        return;
      }

      send({ type: "progress", message: "Reading ZIP…" });

      const arrayBuffer = await zipFile.arrayBuffer();
      const zipBuffer = Buffer.from(arrayBuffer);

      send({ type: "progress", message: "Parsing Rise export…" });

      const { course, images, warnings } = await parseRiseExport(zipBuffer);

      if (warnings.length > 0) {
        console.warn("Rise parse warnings:", warnings);
      }

      send({ type: "progress", message: "Converting images to data URLs…" });

      // Convert image buffers → data URLs (same format as imageData in /api/import)
      const imageData: Record<number, { filename: string; dataUrl: string }> = {};
      for (const [idxStr, img] of Object.entries(images)) {
        const idx = Number(idxStr);
        const b64 = img.buffer.toString("base64");
        imageData[idx] = {
          filename: img.filename,
          dataUrl: `data:${img.contentType};base64,${b64}`,
        };
      }

      send({ type: "complete", course, imageData, warnings });
    } catch (err) {
      console.error("extract-rise error:", err);
      send({ type: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      close();
    }
  })();

  return sseResponse(stream);
}
