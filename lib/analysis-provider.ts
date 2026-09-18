import { MeetingAnalysis, requirementKey } from "./models";
import { AnalysisInput } from "./analysis-contract";
import { scenarios } from "./demo";

export interface AnalysisProvider<Result = MeetingAnalysis | Promise<MeetingAnalysis>> {
  analyze(meeting: AnalysisInput): Result;
}
export class MockAnalysisProvider implements AnalysisProvider<MeetingAnalysis> {
  analyze(meeting: AnalysisInput): MeetingAnalysis {
    const scenario = scenarios.find(
      (s) =>
        s.id === meeting.transcript.scenarioId &&
        s.templateId === meeting.templateId &&
        s.transcript === meeting.transcript.text,
    );
    if (!scenario)
      throw new Error(
        "Demo analysis requires an unchanged demo transcript. Load a demo scenario or use AI analysis.",
      );
    const analysis = structuredClone(scenario.analysis);
    const compatible = (f: { requirementId: string; requirementKey: string }) =>
      meeting.requirements.items.some(
        (r) =>
          r.id === f.requirementId &&
          requirementKey(r, meeting.requirements.items) === f.requirementKey,
      );
    const validIds = new Set(
      [
        ...analysis.goals,
        ...analysis.conclusions,
        ...analysis.topics,
        ...analysis.speakers,
        ...analysis.decisions,
      ]
        .filter(compatible)
        .map((f) => f.requirementId),
    );
    // Action fixtures also need their original meaning; never attach evidence to renamed requirements.
    const original = scenarios.find((s) => s.id === scenario.id)!;
    for (const a of original.analysis.actionItems) {
      if (
        meeting.requirements.items.some(
          (r) => r.id === a.requirementId && r.kind === "action" && r.label === a.description,
        )
      )
        validIds.add(a.requirementId!);
    }
    return {
      ...analysis,
      id: `${scenario.id}:${meeting.transcript.revision}:${meeting.requirements.revision}`,
      transcriptRevision: meeting.transcript.revision,
      requirementsRevision: meeting.requirements.revision,
      goals: analysis.goals.filter(compatible),
      conclusions: analysis.conclusions.filter(compatible),
      topics: analysis.topics.filter(compatible),
      speakers: analysis.speakers.filter(compatible),
      decisions: analysis.decisions.filter(compatible),
      actionItems: analysis.actionItems.filter((a) => validIds.has(a.requirementId!)),
      evidence: analysis.evidence.map((e) => ({
        ...e,
        transcriptRevision: meeting.transcript.revision,
      })),
    };
  }
}
export const demoAnalysisProvider = new MockAnalysisProvider();
