import { Meeting } from "./models";
import { checkCompletion, hasCurrentAnalysis } from "./rule-engine";

export function readinessAction(meeting: Meeting, pending = false, needsAnalysis = false) {
  if (pending) return "Analyzing";
  const input = { ...meeting, transcriptRevision: meeting.transcript.revision };
  if (needsAnalysis || !hasCurrentAnalysis(input)) return "Prepare to End Meeting";
  return checkCompletion(input).readiness === "READY" ? "End Meeting" : "Not Ready to End";
}
