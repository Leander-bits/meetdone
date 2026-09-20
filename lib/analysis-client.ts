import { analysisSchema, Meeting, MeetingAnalysis } from "./models";
import { AnalysisError, AnalysisErrorCode, transcriptError } from "./analysis-contract";
export async function requestAnalysis(
  meeting: Meeting,
  signal?: AbortSignal,
): Promise<MeetingAnalysis> {
  const invalid = transcriptError(meeting.transcript.text);
  if (invalid) throw new AnalysisError(invalid);
  try {
    const response = await fetch("/api/analyze-meeting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(55_000)])
        : AbortSignal.timeout(55_000),
      body: JSON.stringify({
        requirements: meeting.requirements,
        transcript: {
          text: meeting.transcript.text,
          revision: meeting.transcript.revision,
          scenarioId: meeting.transcript.scenarioId,
        },
        templateId: meeting.templateId,
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      const allowed: AnalysisErrorCode[] = [
        "EMPTY_TRANSCRIPT",
        "TRANSCRIPT_TOO_SHORT",
        "TRANSCRIPT_TOO_LONG",
        "INVALID_REQUEST",
        "MISSING_API_KEY",
        "TIMEOUT",
        "PROVIDER_ERROR",
        "INVALID_OUTPUT",
        "STALE_ANALYSIS",
      ];
      throw new AnalysisError(allowed.includes(body?.error) ? body.error : "PROVIDER_ERROR");
    }
    const parsed = analysisSchema.safeParse(body.analysis);
    if (!parsed.success || parsed.data.provider !== "deepseek") throw new AnalysisError("INVALID_OUTPUT");
    return parsed.data;
  } catch (error) {
    if (error instanceof AnalysisError) throw error;
    throw new AnalysisError(
      error instanceof DOMException && ["AbortError", "TimeoutError"].includes(error.name)
        ? "TIMEOUT"
        : "PROVIDER_ERROR",
    );
  }
}
