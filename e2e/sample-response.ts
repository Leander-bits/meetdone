import { MeetingRequirements, requirementKey } from "../lib/models";
import { scenarios } from "../tests/fixtures/demo";

// HTTP test double only: explicit scenario outcomes, keyed to the visible configuration.
export function sampleResponse(requirements: MeetingRequirements, scenarioId: string) {
  const original = scenarios.find((s) => s.id === scenarioId)!.analysis;
  const complete = !scenarioId.endsWith("incomplete");
  const base = (r: MeetingRequirements["items"][number]) => ({
    requirementId: r.id,
    requirementKey: requirementKey(r, requirements.items),
  });
  const coverage = (kind: "goal" | "conclusion" | "topic") =>
    requirements.items
      .filter((r) => r.kind === kind)
      .map((r) => ({ ...original.goals[0], ...base(r), status: "complete" as const }));
  return {
    ...original,
    goals: coverage("goal"),
    conclusions: coverage("conclusion"),
    topics: coverage("topic"),
    speakers: requirements.items
      .filter((r) => r.kind === "speaker")
      .map((r) => ({
        ...(original.speakers.find((s) => s.requirementId === r.id) ?? original.speakers[0]),
        ...base(r),
        status:
          !complete && r.label.startsWith("Sun") ? ("mentioned" as const) : ("opinion" as const),
        classification:
          !complete && r.label.startsWith("Sun")
            ? ("present_no_opinion" as const)
            : ("expressed_opinion" as const),
      })),
    decisions: requirements.items
      .filter((r) => r.kind === "decision")
      .map((r) => ({ ...original.decisions[0], ...base(r) })),
    actionItems: requirements.items
      .filter((r) => r.kind === "action")
      .map((r, i) => ({
        ...original.actionItems[i % original.actionItems.length],
        id: `action-${i}`,
        requirementId: r.id,
        description: r.label,
        source: "ai" as const,
      })),
  };
}
