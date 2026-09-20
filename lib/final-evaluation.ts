import { Meeting } from "./models";
import { evaluateMeeting } from "./meeting-state";
import { validDeadline } from "./rule-engine";

export function finalEvaluation(m: Meeting) {
  const check = evaluateMeeting(m);
  const gaps = [...check.blockingGaps, ...check.followUpGaps];
  const required = (type: string) =>
    gaps.some(
      (g) =>
        g.type === type &&
        m.requirements.items.find((r) => r.id === g.requirementId)?.level === "required",
    );
  return [
    { question: "Were any required topics missed?", problem: required("topic_uncovered") },
    {
      question: "Did any required speaker fail to provide input?",
      problem: required("speaker_missing"),
    },
    {
      question: "Do meeting goals have clear conclusions?",
      problem:
        required("goal_uncovered") || required("conclusion_missing") || !m.analysis?.goals.length,
    },
    {
      question: "Was anything discussed but not decided?",
      problem:
        !!m.analysis?.decisions.some((d) => d.status === "discussed") ||
        !!m.analysis?.unresolvedIssues.length,
    },
    {
      question: "Do all Action Items have an owner and deadline?",
      problem:
        gaps.some((g) => g.type === "action_missing") ||
        m.actionItems.some((a) => !a.owner?.trim() || !validDeadline(a.deadline)),
    },
    {
      question: "Are there unresolved blockers preventing the meeting from ending?",
      problem: check.readiness === "BLOCKED",
    },
  ].map((result, index) => ({
    ...result,
    answer: [2, 4].includes(index) ? !result.problem : result.problem,
  }));
}
