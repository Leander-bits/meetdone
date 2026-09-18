import { Meeting, MeetingAnalysis, MeetingTemplate, requirementKey } from "./models";
import { getTemplate } from "./templates";

export type DemoScenario = {
  id: string;
  templateId: MeetingTemplate["id"];
  name: string;
  description: string;
  transcript: string;
  analysis: Omit<MeetingAnalysis, "id" | "transcriptRevision" | "requirementsRevision">;
};
const launchLines = [
  "Maya · Product: We have evaluated Atlas readiness across Product, Engineering, and Sales using the submitted reports. The team agrees that the readiness assessment is positive, pending Sales input and the final call. Product is ready: onboarding and launch content are approved.",
  "Alex · Engineering: Engineering is ready. Load tests passed. We reviewed launch risks; the rollback procedure and on-call coverage mitigate the remaining operational risk.",
  "Maya · Product: Jordan from Sales is on the invite, but we have not heard their opinion. We discussed Go / No-Go; the final decision is still pending.",
  "Maya · Product: Someone needs to send the launch announcement by 2026-09-24. We have not assigned an owner.",
  "Alex · Engineering: I will publish the launch monitoring checklist. We have not agreed a deadline.",
];
function makeScenario(
  templateId: MeetingTemplate["id"],
  complete: boolean,
  lines: string[],
): DemoScenario {
  const t = getTemplate(templateId);
  const id = `${templateId}-${complete ? "complete" : "incomplete"}`;
  const evidence = lines.map((line, i) => ({
    id: `e${i + 1}`,
    transcriptRevision: 1,
    segmentId: `line-${i * 2 + 1}`,
    speaker: line.split(": ")[0],
    quote: line.slice(line.indexOf(": ") + 2),
  }));
  const base = (r: (typeof t.requirements.items)[number], evidenceIndex = 0) => ({
    requirementId: r.id,
    requirementKey: requirementKey(r, t.requirements.items),
    evidenceIds: [`e${evidenceIndex + 1}`],
  });
  const detail = (index: number) => evidence[index].quote;
  const analysis: DemoScenario["analysis"] = {
    provider: "demo",
    scenarioId: id,
    evidence,
    goals: t.requirements.items
      .filter((r) => r.kind === "goal")
      .map((r) => ({ ...base(r), status: "complete", detail: detail(0) })),
    conclusions: t.requirements.items
      .filter((r) => r.kind === "conclusion")
      .map((r) => ({ ...base(r), status: "complete", detail: detail(0) })),
    topics: t.requirements.items
      .filter((r) => r.kind === "topic" && r.level === "required")
      .map((r) => ({
        ...base(r, r.id === "l-topic-risks" ? 1 : 0),
        status: "complete",
        detail: detail(r.id === "l-topic-risks" ? 1 : 0),
      })),
    speakers: t.requirements.items
      .filter((r) => r.kind === "speaker")
      .map((r, i) => {
        const index = templateId === "launch" && i === 2 ? (complete ? 5 : 2) : i;
        return {
          ...base(r, index),
          status: r.id === "l-sales" && !complete ? "mentioned" : "opinion",
          detail: detail(index),
        };
      }),
    decisions: t.requirements.items
      .filter((r) => r.kind === "decision")
      .map((r) => {
        const index = templateId === "launch" ? (complete ? 6 : 2) : 2;
        return {
          ...base(r, index),
          status: complete ? "decided" : "discussed",
          detail: detail(index),
        };
      }),
    actionItems: t.requirements.items
      .filter((r) => r.kind === "action")
      .map((r, i) => ({
        id: `${templateId}-action-${i}`,
        requirementId: r.id,
        description: r.label,
        owner:
          templateId === "launch"
            ? i === 0
              ? complete
                ? "Jordan · Sales"
                : ""
              : "Alex · Engineering"
            : templateId === "retro"
              ? "Lee · Engineering"
              : "Taylor · Customer success",
        deadline: !complete && i === 1 ? "" : "2026-09-24",
        status: "open",
        source: "demo",
        evidenceIds: [`e${templateId === "launch" ? (complete ? 8 + i : 4 + i) : 4}`],
      })),
    unresolvedIssues: [],
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
    transcript: lines.join("\n\n"),
    analysis,
  };
}
export const scenarios: DemoScenario[] = [
  makeScenario("launch", false, launchLines),
  makeScenario("launch", true, [
    ...launchLines,
    "Jordan · Sales: Sales is ready for launch. Training is complete, and I support a Go decision.",
    "Maya · Product: With Product, Engineering, and Sales in agreement, the final decision is Go for the Atlas launch on 2026-09-25.",
    "Jordan · Sales: I will own sending the launch announcement by 2026-09-24.",
    "Alex · Engineering: I confirm the deadline for publishing the launch monitoring checklist is 2026-09-24.",
  ]),
  makeScenario("retro", true, [
    "Sam · Team lead: We identified what helped and slowed delivery. Pairing helped us ship; large reviews delayed us. We agree that smaller reviews are the main lesson. I support trying them next sprint.",
    "Lee · Engineering: I agree. In my view smaller pull requests will reduce review delays, and we should keep pairing.",
    "Sam · Team lead: We decide to cap pull requests at one small change for the next sprint. Longer-term tooling can be discussed later.",
    "Lee · Engineering: I will trial the agreed improvement by 2026-09-24 and report back.",
  ]),
  makeScenario("customer", true, [
    "Taylor · Customer success: We reviewed milestone progress and customer blockers. Delivery is on track for pilot acceptance. We agree that the current delivery status is on track. I recommend proceeding with the pilot.",
    "Casey · Customer: I agree that we are on track. The access blocker is resolved and I support the pilot milestone.",
    "Taylor · Customer success: We agree on pilot acceptance on 2026-09-30, with five users completing the core workflow as acceptance criteria. Additional training needs can be reviewed later.",
    "Taylor · Customer success: I will share the updated milestone plan by 2026-09-24.",
  ]),
];
export function createMeeting(
  templateId: MeetingTemplate["id"],
  id: string,
  isDemo = false,
): Meeting {
  const template = getTemplate(templateId);
  const now = new Date().toISOString();
  return {
    id,
    title: template.defaultTitle,
    builtinTitle: true,
    templateId,
    isDemo,
    createdAt: now,
    updatedAt: now,
    lifecycle: "active",
    stateRevision: 1,
    requirements: structuredClone(template.requirements),
    transcript: { text: "", revision: 1, scenarioId: null },
    analysis: null,
    actionItems: [],
    gapResolutions: [],
    completionCheck: null,
    summary: null,
  };
}
