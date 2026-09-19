import { MeetingTemplate, Requirement } from "./models";

function req(
  id: string,
  kind: Requirement["kind"],
  label: string,
  extra: Partial<Requirement> = {},
): Requirement {
  return { id, kind, label, builtinKey: label, level: "required", allowsDeferral: false, ...extra };
}
export const templates: MeetingTemplate[] = [
  {
    id: "launch",
    name: "Product Launch Decision",
    description: "Align the team on readiness and make a clear Go / No-Go call.",
    defaultTitle: "Bosch CE T4 Station Data Editor release review",
    requirements: {
      revision: 1,
      items: [
        req("l-goal", "goal", "Assess Data Editor production readiness and remaining gaps"),
        req("l-conclusion", "conclusion", "Agree on the launch readiness assessment"),
        req("l-topic-readiness", "topic", "Launch readiness"),
        req("l-topic-risks", "topic", "Launch risks and mitigation"),
        req("l-product", "speaker", "Devi · Product", { topicId: "l-topic-readiness" }),
        req("l-engineering", "speaker", "Max · Engineering", { topicId: "l-topic-readiness" }),
        req("l-sales", "speaker", "Sun · Operations", { topicId: "l-topic-readiness" }),
        req("l-decision", "decision", "Make the final Go / No-Go decision"),
        req("l-action-comms", "action", "Send the release notice"),
        req("l-action-monitor", "action", "Publish the release monitoring checklist"),
        req(
          "l-agenda-1",
          "agenda",
          "Readiness roundtable → review risks → Go / No-Go → assign next steps",
          { level: "record_only" },
        ),
      ],
    },
  },
  {
    id: "retro",
    name: "Project Retrospective",
    description: "Turn lessons learned into agreed improvements with clear ownership.",
    defaultTitle: "Bosch CE T4 Pipeline V2 sprint retrospective",
    requirements: {
      revision: 1,
      items: [
        req(
          "r-goal",
          "goal",
          "Review the document-to-structured-data sprint and identify improvements",
        ),
        req("r-conclusion", "conclusion", "Agree on the main lesson from the sprint"),
        req("r-topic", "topic", "Delivery successes and friction"),
        req("r-lead", "speaker", "Devi · Team lead", { topicId: "r-topic" }),
        req("r-dev", "speaker", "Jiaheng · Engineering", { topicId: "r-topic" }),
        req("r-decision", "decision", "Choose one improvement for the next sprint"),
        req("r-action", "action", "Trial the agreed improvement"),
        req("r-extra", "topic", "Explore a longer-term tooling improvement", {
          level: "recommended",
          allowsDeferral: true,
        }),
        req("r-agenda", "agenda", "What worked → what did not → choose one experiment", {
          level: "record_only",
        }),
      ],
    },
  },
  {
    id: "customer",
    name: "Customer Progress Meeting",
    description: "Confirm progress, surface blockers, and agree on the next milestone.",
    defaultTitle: "Bosch Manufacturing Solutions · CE T4 project progress",
    requirements: {
      revision: 1,
      items: [
        req("c-goal", "goal", "Confirm the customer is on track for the next milestone"),
        req("c-conclusion", "conclusion", "Agree on the current delivery status"),
        req("c-topic", "topic", "Milestone progress and customer blockers"),
        req("c-csm", "speaker", "Alex · Project lead", { topicId: "c-topic" }),
        req("c-client", "speaker", "Sun · Customer", { topicId: "c-topic" }),
        req("c-decision", "decision", "Confirm the next milestone and acceptance criteria"),
        req("c-action", "action", "Share the updated milestone plan"),
        req("c-extra", "topic", "Review additional training needs", {
          level: "recommended",
          allowsDeferral: true,
        }),
        req("c-agenda", "agenda", "Progress update → customer feedback → milestone → next steps", {
          level: "record_only",
        }),
      ],
    },
  },
];
export function getTemplate(id: MeetingTemplate["id"]) {
  return templates.find((t) => t.id === id);
}
