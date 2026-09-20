import {
  ActionItem,
  CompletionCheck,
  Gap,
  GapResolution,
  MeetingAnalysis,
  MeetingRequirements,
  Requirement,
  requirementKey,
  actionValidation,
} from "./models";

export type CheckInput = {
  requirements: MeetingRequirements;
  analysis: MeetingAnalysis | null;
  actionItems: ActionItem[];
  gapResolutions: GapResolution[];
  transcriptRevision: number;
  stateRevision: number;
};
export function validDeadline(value: string | null): boolean {
  if (!value) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function hasCurrentAnalysis(input: CheckInput): boolean {
  return (
    !!input.analysis &&
    input.analysis.transcriptRevision === input.transcriptRevision &&
    input.analysis.requirementsRevision === input.requirements.revision
  );
}
export function checkCompletion(input: CheckInput): CompletionCheck {
  const { requirements, analysis, actionItems, gapResolutions } = input;
  const gaps: Gap[] = [];
  function add(
    type: Gap["type"],
    r: Requirement | undefined,
    explanation: string,
    nextAction: string,
    evidenceIds: string[] = [],
    suffix = "",
    severity?: Gap["severity"],
  ) {
    if (r?.level === "record_only") return;
    gaps.push({
      id: `${type}:${r?.id ?? "meeting"}${suffix}`,
      type,
      severity:
        r?.level === "recommended"
          ? "FOLLOW_UP"
          : (severity ?? (r?.level === "required" ? "BLOCKING" : "FOLLOW_UP")),
      requirementId: r?.id,
      title:
        r?.label ??
        (type === "analysis_missing"
          ? "Meeting analysis"
          : type === "unresolved_issue"
            ? "Unresolved issue"
            : "Follow-up action"),
      explanation,
      nextAction,
      evidenceIds,
      allowsDeferral: r?.allowsDeferral ?? false,
    });
  }
  if (!hasCurrentAnalysis(input)) {
    add(
      "analysis_missing",
      undefined,
      "The current transcript and requirements have not been analyzed.",
      "Analyze the transcript before ending the meeting.",
      [],
      "",
      "BLOCKING",
    );
  } else if (analysis) {
    for (const r of requirements.items) {
      if (r.level === "record_only") continue;
      const matches = (f: { requirementId: string; requirementKey: string }) =>
        f.requirementId === r.id && f.requirementKey === requirementKey(r, requirements.items);
      if (
        r.kind === "goal" ||
        r.kind === "conclusion" ||
        r.kind === "topic" ||
        r.kind === "agenda"
      ) {
        const list =
          r.kind === "goal"
            ? analysis.goals
            : r.kind === "conclusion"
              ? analysis.conclusions
              : analysis.topics;
        const finding = list.find(matches);
        if (finding?.status !== "complete")
          add(
            r.kind === "goal"
              ? "goal_uncovered"
              : r.kind === "conclusion"
                ? "conclusion_missing"
                : "topic_uncovered",
            r,
            finding?.status === "partial"
              ? "Only partially covered in the discussion."
              : "No evidence that this requirement has been completed.",
            "Discuss this requirement and capture a supported conclusion.",
            finding?.evidenceIds,
          );
      }
      if (r.kind === "speaker") {
        const finding = analysis.speakers.find(matches);
        if (finding?.status !== "opinion")
          add(
            "speaker_missing",
            r,
            finding?.status === "mentioned"
              ? "This speaker was mentioned, but has not expressed an opinion on the required topic."
              : "No opinion captured from this speaker on the required topic.",
            "Invite this speaker to share their assessment.",
            finding?.evidenceIds,
          );
      }
      if (r.kind === "decision") {
        const finding = analysis.decisions.find(matches);
        if (finding?.status !== "decided")
          add(
            finding?.status === "discussed" ? "decision_pending" : "decision_missing",
            r,
            finding?.status === "discussed"
              ? "Discussed, not decided. A final decision has not been made."
              : "No final decision is captured.",
            "Ask for an explicit decision and record the outcome.",
            finding?.evidenceIds,
          );
      }
      if (r.kind === "action") {
        const { requireOwner, requireDeadline } = actionValidation(r);
        const actions = actionItems.filter((a) => a.requirementId === r.id);
        if (!actions.length)
          add(
            "action_missing",
            r,
            "The required action output has not been assigned.",
            "Create the required action output.",
          );
        for (const a of actions) {
          if (!a.description.trim())
            add(
              "action_missing",
              r,
              "The linked action has no description.",
              "Describe the required action output.",
              a.evidenceIds,
              `:${a.id}`,
            );
          if (requireOwner && !(a.owner ?? "").trim())
            add(
              "action_owner",
              r,
              `“${a.description}” has no owner.`,
              "Assign a person accountable for this action.",
              a.evidenceIds,
              `:${a.id}`,
            );
          if (requireDeadline && !validDeadline(a.deadline))
            add(
              "action_deadline",
              r,
              `“${a.description}” has no valid deadline.`,
              "Agree on a specific due date.",
              a.evidenceIds,
              `:${a.id}`,
            );
        }
      }
    }
    for (const issue of analysis.unresolvedIssues) {
      const r = requirements.items.find((r) => r.id === issue.requirementId);
      const supported = (id: string) =>
        issue.evidenceIds.includes(id) &&
        analysis.evidence.some(
          (e) =>
            e.id === id && e.transcriptRevision === input.transcriptRevision && !!e.quote.trim(),
        );
      // Legacy boolean alone is not enough. An issue needs a required-outcome
      // relationship or an explicit critical statement, with current evidence.
      const preventsRequiredOutcome =
        r?.level === "required" &&
        (issue.preventsOutcome ?? issue.blocking) &&
        issue.evidenceIds.some(supported);
      const explicitlyCritical = !!issue.criticalEvidenceId && supported(issue.criticalEvidenceId);
      const blocking =
        (preventsRequiredOutcome || explicitlyCritical) && (!r || r.level === "required");
      add(
        "unresolved_issue",
        r,
        issue.description,
        blocking
          ? "Resolve the issue preventing the required outcome."
          : "Assign a follow-up to track this open issue.",
        issue.evidenceIds,
        `:${issue.id}`,
        blocking ? "BLOCKING" : "FOLLOW_UP",
      );
    }
    // Ad-hoc follow-ups still surface incomplete commitments.
    for (const a of actionItems.filter(
      (a) => !requirements.items.some((r) => r.id === a.requirementId && r.kind === "action"),
    )) {
      if (!a.description.trim())
        add(
          "action_missing",
          undefined,
          "An additional action has no description.",
          "Describe the follow-up commitment.",
          a.evidenceIds,
          `:${a.id}`,
          "FOLLOW_UP",
        );
      if (!(a.owner ?? "").trim())
        add(
          "action_owner",
          undefined,
          `“${a.description}” has no owner.`,
          "Assign a follow-up owner.",
          a.evidenceIds,
          `:${a.id}`,
          "FOLLOW_UP",
        );
      if (!validDeadline(a.deadline))
        add(
          "action_deadline",
          undefined,
          `“${a.description}” has no deadline.`,
          "Set a follow-up deadline.",
          a.evidenceIds,
          `:${a.id}`,
          "FOLLOW_UP",
        );
    }
  }
  const deferredGapIds: string[] = [];
  const unresolved = gaps.filter((gap) => {
    const resolution = gapResolutions.find((r) => r.gapId === gap.id && r.type === "action");
    const action = actionItems.find((a) => a.id === resolution?.actionItemId && a.gapId === gap.id);
    if (
      (gap.severity === "FOLLOW_UP" || gap.allowsDeferral) &&
      action?.description.trim() &&
      action?.owner?.trim() &&
      validDeadline(action.deadline)
    ) {
      deferredGapIds.push(gap.id);
      return false;
    }
    return true;
  });
  const blockingGaps = unresolved.filter((g) => g.severity === "BLOCKING");
  return {
    readiness: blockingGaps.length === 0 ? "READY" : "BLOCKED",
    requirementsRevision: requirements.revision,
    transcriptRevision: input.transcriptRevision,
    stateRevision: input.stateRevision,
    blockingGaps,
    followUpGaps: unresolved.filter((g) => g.severity === "FOLLOW_UP"),
    deferredGapIds,
  };
}
