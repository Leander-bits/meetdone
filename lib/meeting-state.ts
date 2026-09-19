import { demoAnalysisProvider } from "./analysis-provider";
import { createMeeting, scenarios } from "./demo";
import {
  ActionItem,
  Gap,
  Meeting,
  MeetingRequirements,
  MeetingSummary,
  MeetingAnalysis,
  requirementKey,
} from "./models";
import { checkCompletion, validDeadline } from "./rule-engine";
import { validRequirementLists } from "./requirements";
import { AnalysisError } from "./analysis-contract";

export function evaluateMeeting(m: Meeting) {
  return checkCompletion({ ...m, transcriptRevision: m.transcript.revision });
}
function ensureActive(m: Meeting) {
  if (m.lifecycle !== "active")
    throw new Error("This meeting has ended. Its summary is preserved.");
}
function changed(m: Meeting): Meeting {
  ensureActive(m);
  return {
    ...m,
    stateRevision: m.stateRevision + 1,
    updatedAt: new Date().toISOString(),
    completionCheck: null,
    summary: null,
  };
}
export function updateRequirements(m: Meeting, requirements: MeetingRequirements): Meeting {
  if (!validRequirementLists(requirements))
    throw new Error(
      "Keep at least one goal, conclusion, topic, speaker input, and action output. All items need text.",
    );
  return {
    ...changed(m),
    requirements: { ...requirements, revision: m.requirements.revision + 1 },
    analysis: null,
    gapResolutions: [],
    actionItems: m.actionItems
      .filter((a) => a.source === "host")
      .map((a) => {
        const original = m.requirements.items.find((r) => r.id === a.requirementId);
        const updated = requirements.items.find((r) => r.id === a.requirementId);
        return {
          ...a,
          requirementId:
            original && updated && requirementKey(original) === requirementKey(updated)
              ? a.requirementId
              : undefined,
        };
      }),
  };
}
export function updateTranscript(m: Meeting, text: string, fileName?: string): Meeting {
  const scenario = scenarios.find((s) => s.templateId === m.templateId && s.transcript === text);
  return {
    ...changed(m),
    transcript: {
      text,
      revision: m.transcript.revision + 1,
      scenarioId: scenario?.id ?? null,
      ...(fileName ? { fileName } : {}),
    },
    analysis: null,
    gapResolutions: [],
    actionItems: m.actionItems
      .filter((a) => a.source === "host")
      .map((a) => ({ ...a, evidenceIds: [] })),
  };
}
export function analyzeMeeting(m: Meeting): Meeting {
  const analysis = demoAnalysisProvider.analyze(m);
  return applyAnalysis(m, analysis);
}
export function applyAnalysis(
  m: Meeting,
  analysis: MeetingAnalysis,
  expectedStateRevision?: number,
): Meeting {
  if (
    analysis.transcriptRevision !== m.transcript.revision ||
    analysis.requirementsRevision !== m.requirements.revision ||
    (expectedStateRevision !== undefined && expectedStateRevision !== m.stateRevision)
  )
    throw new AnalysisError("STALE_ANALYSIS");
  const hostActions = m.actionItems.filter((a) => a.source === "host");
  const hostIds = new Set(hostActions.map((a) => a.id));
  const next: Meeting = {
    ...changed(m),
    analysis,
    actionItems: [...analysis.actionItems.filter((a) => !hostIds.has(a.id)), ...hostActions],
    gapResolutions: m.gapResolutions.filter((r) => r.type === "action"),
  };
  return analysis.provider === "demo" ? next : { ...next, completionCheck: evaluateMeeting(next) };
}
export function loadScenario(m: Meeting, id: string): Meeting {
  const scenario = scenarios.find((s) => s.id === id && s.templateId === m.templateId);
  if (!scenario) throw new Error("Scenario does not match this meeting template.");
  return updateTranscript(m, scenario.transcript);
}
export function updateActionItems(m: Meeting, actionItems: ActionItem[]): Meeting {
  return { ...changed(m), actionItems };
}
export function prepareMeeting(m: Meeting): Meeting {
  ensureActive(m);
  return { ...m, completionCheck: evaluateMeeting(m) };
}
export function convertGap(m: Meeting, gap: Gap, action: ActionItem): Meeting {
  const current = evaluateMeeting(m);
  if (![...current.blockingGaps, ...current.followUpGaps].some((g) => g.id === gap.id))
    throw new Error("This gap is no longer current. Run the check again.");
  if (!action.description.trim() || !(action.owner ?? "").trim() || !validDeadline(action.deadline))
    throw new Error("A follow-up needs a description, an owner, and a valid deadline.");
  const item: ActionItem = { ...action, source: "host", gapId: gap.id };
  // Required output gaps can be repaired by supplying the missing output itself.
  if (gap.type === "action_missing") item.requirementId = gap.requirementId;
  return {
    ...changed(m),
    actionItems: [...m.actionItems, item],
    gapResolutions: [
      ...m.gapResolutions.filter((r) => r.gapId !== gap.id),
      {
        id: `resolution-${action.id}`,
        gapId: gap.id,
        type: "action",
        actionItemId: action.id,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}
export function buildSummary(m: Meeting, endedAt: string): MeetingSummary {
  if (!m.analysis) throw new Error("Analyze the transcript before generating a summary.");
  const check = evaluateMeeting(m);
  const allGaps = [...check.blockingGaps, ...check.followUpGaps];
  return {
    originalGoal: m.requirements.items
      .filter((r) => r.kind === "goal")
      .map((r) => r.label)
      .join("; "),
    goalsAchieved: m.analysis.goals
      .filter((g) => g.status === "complete")
      .map((g) => m.requirements.items.find((r) => r.id === g.requirementId)?.label ?? g.detail),
    conclusions: m.analysis.conclusions.filter((g) => g.status === "complete").map((g) => g.detail),
    decisions: m.analysis.decisions.filter((d) => d.status === "decided").map((d) => d.detail),
    unresolvedIssues: m.analysis.unresolvedIssues.map((i) => i.description),
    actionItems: structuredClone(m.actionItems),
    remainingRisks: allGaps.map((g) => `${g.title}: ${g.explanation}`),
    acceptedExceptions: m.gapResolutions
      .filter((r) => r.type === "exception")
      .map((r) => ({
        gap: allGaps.find((g) => g.id === r.gapId)?.title ?? r.gapId,
        reason: r.reason!,
      })),
    lifecycle: m.lifecycle,
    readiness: check.readiness,
    endedAt,
    analysisId: m.analysis.id,
  };
}
export function endMeeting(m: Meeting, exceptionReason?: string): Meeting {
  ensureActive(m);
  const check = evaluateMeeting(m);
  if (!m.analysis || check.blockingGaps.some((g) => g.type === "analysis_missing"))
    throw new Error("Analyze the current transcript before ending.");
  if (!m.completionCheck || m.completionCheck.stateRevision !== m.stateRevision)
    throw new Error("Prepare to end the meeting again after your latest changes.");
  if (check.readiness === "BLOCKED" && !exceptionReason?.trim())
    throw new Error("An exception reason is required to end with blockers.");
  const now = new Date().toISOString();
  const ended: Meeting = {
    ...m,
    lifecycle: check.readiness === "READY" ? "ended" : "ended_with_exceptions",
    completionCheck: check,
    updatedAt: now,
    gapResolutions: [
      ...m.gapResolutions,
      ...check.blockingGaps.map((g) => ({
        id: `exception-${g.id}`,
        gapId: g.id,
        type: "exception" as const,
        reason: exceptionReason!.trim(),
        createdAt: now,
      })),
    ],
  };
  return { ...ended, summary: buildSummary(ended, now) };
}
export function freshDemo(): Meeting {
  return analyzeMeeting(
    loadScenario(createMeeting("launch", "demo-launch", true), "launch-incomplete"),
  );
}
