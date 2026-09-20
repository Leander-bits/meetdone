import { Meeting, MeetingAnalysis, MeetingTemplate, Requirement, requirementKey } from "./models";
import { getTemplate } from "./templates";
import { demoConfiguration, demoTitles } from "./demo-configuration";
import { initialStructure, compileRequirements } from "./meeting-structure";
import {
  DemoLine,
  launchDiscussion,
  launchFollowUp,
  retroDiscussion,
  customerDiscussion,
} from "./demo-transcripts";
export type DemoScenario = {
  id: string;
  templateId: string;
  name: string;
  description: string;
  transcript: string;
  analysis: Omit<MeetingAnalysis, "id" | "transcriptRevision" | "requirementsRevision">;
};
function makeScenario(templateId: string, complete: boolean, lines: DemoLine[]): DemoScenario {
  const template = demoConfiguration(templateId);
  const id = `${templateId}-${complete ? "complete" : "incomplete"}`;
  const evidence = lines.map((line, i) => ({
    id: line.id,
    transcriptRevision: 1,
    segmentId: `line-${i * 2 + 1}`,
    speaker: line.speaker,
    quote: line.text,
  }));
  const base = (r: Requirement, ids: string[]) => ({
    requirementId: r.id,
    requirementKey: requirementKey(r, template.requirements.items),
    evidenceIds: ids,
  });
  const quote = (id: string) => evidence.find((e) => e.id === id)!.quote;
  const assessment =
    templateId === "launch" ? "assessment" : templateId === "retro" ? "lesson" : "progress";
  const decision =
    templateId === "launch" ? (complete ? "final-decision" : "decision-pending") : "decision";
  const speakerEvidence: Record<string, string> = {
    "l-product": "scope",
    "l-engineering": "engineering",
    "l-sales": complete ? "sales-opinion" : "sales-missing",
    "r-lead": "lead-opinion",
    "r-dev": "engineering",
    "c-csm": "lead-opinion",
    "c-client": "client-opinion",
    "speaker-structure-progress-sun": "lead-opinion",
    "speaker-structure-progress-jiaheng": "progress",
    "speaker-structure-feedback-alex": "client-opinion",
    "speaker-structure-feedback-devi": "boundary",
    "speaker-structure-next-jiaheng": "action",
    "speaker-structure-next-alex": "next-confirm",
  };
  const analysis: DemoScenario["analysis"] = {
    provider: "demo",
    scenarioId: id,
    evidence,
    goals: template.requirements.items
      .filter((r) => r.kind === "goal")
      .map((r) => ({ ...base(r, [assessment]), status: "complete", detail: quote(assessment) })),
    conclusions: template.requirements.items
      .filter((r) => r.kind === "conclusion")
      .map((r) => ({ ...base(r, [assessment]), status: "complete", detail: quote(assessment) })),
    topics: template.requirements.items
      .filter((r) => r.kind === "topic" && r.level === "required")
      .map((r) => {
        const anchor =
          r.id === "l-topic-risks"
            ? "risks"
            : r.id === "structure-feedback"
              ? "client-opinion"
              : r.id === "structure-next"
                ? "decision"
                : r.id === "structure-stage-0"
                  ? "worked"
                  : r.id === "structure-stage-1"
                    ? "sample-plan"
                    : r.id === "structure-stage-2"
                      ? "boundary"
                      : r.id === "structure-stage-3"
                        ? "decision"
                        : r.id === "structure-stage-4"
                          ? "action"
                          : assessment;
        return { ...base(r, [anchor]), status: "complete", detail: quote(anchor) };
      }),
    speakers: template.requirements.items
      .filter((r) => r.kind === "speaker")
      .map((r) => {
        const anchor = speakerEvidence[r.id];
        const missingOpinion = r.id === "l-sales" && !complete;
        return {
          ...base(r, [anchor]),
          status: missingOpinion ? "mentioned" : "opinion",
          classification: missingOpinion ? "present_no_opinion" : "expressed_opinion",
          detail: quote(anchor),
        };
      }),
    decisions: template.requirements.items
      .filter((r) => r.kind === "decision")
      .map((r) => ({
        ...base(r, [decision]),
        status: complete ? "decided" : "discussed",
        classification: complete ? "decided" : "discussed_not_decided",
        outcome: complete ? quote(decision) : null,
        detail: quote(decision),
      })),
    actionItems: template.requirements.items
      .filter((r) => r.kind === "action")
      .map((r, i) => ({
        id: `${templateId}-action-${i}`,
        requirementId: r.id,
        description: r.label,
        owner:
          templateId === "launch"
            ? i === 0
              ? complete
                ? "Sun"
                : null
              : "Max"
            : templateId === "retro"
              ? "Jiaheng"
              : "Jiaheng",
        deadline: !complete && i === 1 ? null : "2026-09-24",
        status: "open",
        source: "demo",
        evidenceIds: [
          templateId === "launch"
            ? i === 0
              ? complete
                ? "notice-owned"
                : "notice"
              : complete
                ? "monitor-dated"
                : "monitor"
            : "action",
        ],
      })),
    unresolvedIssues:
      templateId === "customer"
        ? [
            {
              id: "list-sorting",
              description: quote("feedback"),
              blocking: false,
              evidenceIds: ["feedback", "boundary"],
            },
          ]
        : [],
  };
  return {
    id,
    templateId,
    name:
      templateId === "launch"
        ? complete
          ? "Scenario B · Complete"
          : "Scenario A · Incomplete"
        : "Complete example",
    description: complete
      ? "Discussion and commitments are captured."
      : "Four blockers to resolve before ending.",
    transcript: lines.map((line) => `${line.speaker}：${line.text}`).join("\n\n"),
    analysis,
  };
}
export const scenarios = [
  makeScenario("launch", false, launchDiscussion),
  makeScenario("launch", true, [...launchDiscussion, ...launchFollowUp]),
  makeScenario("retro", true, retroDiscussion),
  makeScenario("customer", true, customerDiscussion),
];
export function createMeeting(
  templateId: MeetingTemplate["id"],
  id: string,
  isDemo = false,
  customTemplate?: MeetingTemplate,
): Meeting {
  const template = customTemplate ?? getTemplate(templateId);
  if (!template || template.id !== templateId) throw new Error("Template not found.");
  const now = new Date().toISOString();
  return {
    id,
    title: demoTitles[templateId] ?? template.name,
    builtinTitle: !customTemplate,
    templateId,
    isDemo,
    createdAt: now,
    updatedAt: now,
    lifecycle: "active",
    stateRevision: 1,
    ...(!customTemplate
      ? demoConfiguration(templateId)
      : {
          date: "",
          startTime: "09:00",
          endTime: "09:30",
          timezone: "UTC",
          participants: [],
          goals: structuredClone(template.defaultGoals),
          structure: initialStructure(template.structureType, 30, [], template),
          requirements: compileRequirements(
            template.defaultGoals,
            initialStructure(template.structureType, 30, [], template),
            [],
            template.rules,
          ),
        }),
    transcript: { text: "", revision: 1, scenarioId: null },
    analysis: null,
    actionItems: [],
    gapResolutions: [],
    completionCheck: null,
    summary: null,
  };
}
