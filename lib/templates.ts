import { MeetingTemplate, Requirement } from "./models";

function req(
  id: string,
  kind: Requirement["kind"],
  label: string,
  extra: Partial<Requirement> = {},
): Requirement {
  return { id, kind, label, builtinKey: label, level: "required", allowsDeferral: false, ...extra };
}
const legacyDefaults = [
  {
    id: "launch",
    name: "Product Launch Decision",
    requirements: {
      revision: 1,
      items: [
        req("l-goal", "goal", "Assess release readiness"),
        req("l-conclusion", "conclusion", "Agree on the launch readiness assessment"),
        req("l-topic-readiness", "topic", "Launch readiness"),
        req("l-topic-risks", "topic", "Launch risks and mitigation"),
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
    requirements: {
      revision: 1,
      items: [
        req("r-goal", "goal", "Review the sprint and agree on improvements"),
        req("r-conclusion", "conclusion", "Agree on the main lesson from the sprint"),
        req("r-topic", "topic", "Delivery successes and friction"),
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
    requirements: {
      revision: 1,
      items: [
        req("c-goal", "goal", "Confirm the customer is on track for the next milestone"),
        req("c-conclusion", "conclusion", "Agree on the current delivery status"),
        req("c-topic", "topic", "Milestone progress and customer blockers"),
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
export const templates: MeetingTemplate[] = legacyDefaults.map((t) => ({
  id: t.id,
  name: t.name,
  structureType: t.id === "launch" ? "time" : t.id === "retro" ? "stages" : "matrix",
  defaultGoals: t.requirements.items
    .filter((r) => r.kind === "goal")
    .map((r) => ({
      ...r,
      label:
        t.id === "launch"
          ? "Assess release readiness"
          : t.id === "retro"
            ? "Review the sprint and agree on improvements"
            : r.label,
      builtinKey:
        t.id === "launch"
          ? "Assess release readiness"
          : t.id === "retro"
            ? "Review the sprint and agree on improvements"
            : r.label,
    })),
  defaultStages: (t.id === "launch"
    ? ["Opening", "Background", "Discussion", "Decision", "Action Items"]
    : ["Background", "Proposal", "Risks", "Decision", "Next Steps"]
  ).map((name, i) => ({
    id: `stage-${i}`,
    name,
    builtinKey: name,
    goals: [{ id: `stage-goal-${i}`, text: "" }],
    custom: false,
  })),
  roleRequirements: (t.id === "launch"
    ? ["Product", "Engineering", "Sales"]
    : t.id === "retro"
      ? ["Product", "Engineering"]
      : ["Sales", "Customer"]
  ).map((role, i) => ({
    id: `role-${i}`,
    role: role as "Product" | "Engineering" | "Sales" | "Customer",
    required: true,
  })),
  rules: t.requirements.items.filter((r) => !["goal", "speaker", "agenda"].includes(r.kind)),
}));
export function getTemplate(id: MeetingTemplate["id"]) {
  return templates.find((t) => t.id === id);
}
