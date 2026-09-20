import { Meeting, Requirement, kindLabels } from "./models";

export const ruleKinds = ["topic", "conclusion", "decision", "action"] as const;
export function orderedRequirements(items: Requirement[]) {
  const order: Requirement["kind"][] = ["goal", "speaker", ...ruleKinds, "agenda"];
  return [...items].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

// Presentation only. Stable IDs still link evidence and deterministic validation.
export function requirementDisplay(
  m: Meeting,
  r: Requirement,
  t: (key: string) => string,
  label: (r: Requirement) => string,
) {
  const stages = m.structure.type === "time" ? m.structure.segments : m.structure.stages;
  const stageName = (s: (typeof stages)[number]) => (s.builtinKey === s.name ? t(s.name) : s.name);
  for (const stage of stages) {
    const goal = stage.goals.find((g) => r.id === `structure-goal-${g.id}`);
    if (goal)
      return [
        t(m.structure.type === "time" ? "Time Sequence" : "Stage Goals"),
        stageName(stage),
        goal.builtinKey === goal.text ? t(goal.text) : goal.text,
      ].join(" · ");
    if (r.id === `structure-${stage.id}`) return [t("Stage Goals"), stageName(stage)].join(" · ");
    if (r.kind === "speaker" && r.topicId === `structure-${stage.id}`)
      return [t("Required Speakers by Stage"), stageName(stage), label(r)].join(" · ");
  }
  return [
    t(
      r.kind === "speaker"
        ? "Required Speakers"
        : r.kind === "goal"
          ? "Meeting Goals"
          : kindLabels[r.kind],
    ),
    label(r),
  ].join(" · ");
}
