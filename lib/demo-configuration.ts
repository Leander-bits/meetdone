import { getTemplate } from "./templates";
import { compileRequirements, initialStructure } from "./meeting-structure";
import { Participant, Requirement } from "./models";

export const demoTitles: Record<string, string> = {
  launch: "Mobile feature launch review",
  retro: "Two-week sprint retrospective",
  customer: "Customer onboarding progress",
};
export function demoConfiguration(templateId: string) {
  const template = getTemplate(templateId)!;
  const person = (name: string, role: Participant["role"], roleLabel: string): Participant => ({
    id: name.toLowerCase(),
    email: `${name.toLowerCase()}@example.com`,
    name,
    role,
    roleLabel,
  });
  const participants =
    templateId === "launch"
      ? [
          person("Devi", "Product", "产品"),
          person("Max", "Engineering", "技术"),
          person("Sun", "Sales", "销售"),
          person("Jiaheng", "Other", "项目负责人"),
        ]
      : templateId === "retro"
        ? [
            person("Jiaheng", "Other", "项目负责人"),
            person("Max", "Engineering", "技术"),
            person("Devi", "Product", "产品"),
            person("Alex", "Other", "设计"),
          ]
        : [
            person("Sun", "Sales", "客户成功"),
            person("Jiaheng", "Other", "项目负责人"),
            person("Devi", "Product", "产品"),
            person("Alex", "Customer", "客户"),
          ];
  const structure = initialStructure(template.structureType, 30, participants, template);
  if (templateId === "customer")
    structure.stages = [
      {
        id: "progress",
        name: "Progress",
        builtinKey: "Progress",
        custom: false,
        goals: [{ id: "progress-goal", text: "" }],
        assignments: [
          { participantId: "sun", required: true },
          { participantId: "jiaheng", required: true },
        ],
      },
      {
        id: "feedback",
        name: "Customer feedback",
        builtinKey: "Customer feedback",
        custom: false,
        goals: [{ id: "feedback-goal", text: "" }],
        assignments: [
          { participantId: "alex", required: true },
          { participantId: "devi", required: false },
        ],
      },
      {
        id: "next",
        name: "Next Steps",
        builtinKey: "Next Steps",
        custom: false,
        goals: [{ id: "next-goal", text: "" }],
        assignments: [
          { participantId: "jiaheng", required: true },
          { participantId: "alex", required: true },
        ],
      },
    ];
  const goals = structuredClone(template.defaultGoals);
  const requirements = compileRequirements(goals, structure, participants, template.rules);
  const speaker = (id: string, name: string, topicId: string): Requirement => ({
    id,
    kind: "speaker",
    label:
      participants.find((p) => p.name === name)!.name +
      "（" +
      participants.find((p) => p.name === name)!.roleLabel +
      "）",
    level: "required",
    allowsDeferral: false,
    topicId,
  });
  if (templateId === "launch")
    requirements.items.push(
      speaker("l-product", "Devi", "l-topic-readiness"),
      speaker("l-engineering", "Max", "l-topic-readiness"),
      speaker("l-sales", "Sun", "l-topic-readiness"),
    );
  if (templateId === "retro")
    requirements.items.push(
      speaker("r-lead", "Devi", "r-topic"),
      speaker("r-dev", "Max", "r-topic"),
    );
  return {
    date: "2026-09-23",
    startTime: "09:00",
    endTime: "09:30",
    timezone: "Europe/Berlin",
    participants,
    goals,
    structure,
    requirements,
  };
}
