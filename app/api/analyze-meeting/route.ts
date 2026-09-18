import {
  AnalysisError,
  analysisRequestSchema,
  MAX_REQUEST_BYTES,
  transcriptError,
} from "@/lib/analysis-contract";
import { configuredAnalysisProvider } from "@/lib/server/deepseek-provider";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request): Promise<Response> {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      return Response.json({ error: "INVALID_REQUEST" }, { status: 403 });
    if (!request.headers.get("content-type")?.includes("application/json"))
      throw new AnalysisError("INVALID_REQUEST");
    const reader = request.body?.getReader();
    if (!reader) throw new AnalysisError("INVALID_REQUEST");
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_REQUEST_BYTES) {
          await reader.cancel();
          throw new AnalysisError("TRANSCRIPT_TOO_LONG");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const body = Buffer.concat(chunks).toString("utf8");
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new AnalysisError("INVALID_REQUEST");
    }
    // Check transcript length separately so users get a useful localized error.
    if (json && typeof json === "object" && "transcript" in json) {
      const transcript = json.transcript;
      if (
        transcript &&
        typeof transcript === "object" &&
        "text" in transcript &&
        typeof transcript.text === "string"
      ) {
        const error = transcriptError(transcript.text);
        if (error) throw new AnalysisError(error);
      }
    }
    const input = analysisRequestSchema.safeParse(json);
    if (!input.success) throw new AnalysisError("INVALID_REQUEST");
    const analysis = await configuredAnalysisProvider().analyze(input.data);
    return Response.json({ analysis }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof AnalysisError ? error.code : "PROVIDER_ERROR";
    const status =
      code === "MISSING_API_KEY"
        ? 503
        : code === "TIMEOUT"
          ? 504
          : ["PROVIDER_ERROR", "INVALID_OUTPUT"].includes(code)
            ? 502
            : code === "TRANSCRIPT_TOO_LONG"
              ? 413
              : 400;
    return Response.json({ error: code }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
