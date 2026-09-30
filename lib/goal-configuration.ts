import { Meeting, MeetingStructure, MeetingTemplate, Participant, Requirement } from "./models";
import { compileRequirements } from "./meeting-structure";
import { validRequirementLists } from "./requirements";
import { validStructure } from "./meeting-structure";

export const GOAL_TEXT_LIMIT = 5000;
export const IMPORT_REVIEW_NOTE =
  "Imported goals need review. Shorten the goal text or reduce the number of requirements before analyzing.";
const prefixes: Record<string, Requirement["kind"]> = {
  议题: "topic",
  结论: "conclusion",
  决策: "decision",
  行动项: "action",
  topic: "topic",
  conclusion: "conclusion",
  decision: "decision",
  action: "action",
  发言人: "speaker",
  speaker: "speaker",
  goal: "goal",
  目标: "goal",
};
export function goalDocument(goals: Requirement[], render = (r: Requirement) => r.label) {
  return goals.map(render).join("\n");
}
export function documentGoals(text: string, id = "meeting-goals"): Requirement[] {
  return [{ id, kind: "goal", label: text, level: "required", allowsDeferral: false }];
}
// Only explicit labels determine typed requirements. The model extracts facts, never priorities.
function typedLines(text: string, id: string, topicId?: string): Requirement[] {
  return text.split(/\n/).flatMap((line, i) => {
    const match = line
      .trim()
      .replace(/^[-•*]\s*/, "")
      .match(
        /^(目标|议题|结论|决策|行动项|发言人|goal|topic|conclusion|decision|action|speaker)\s*(?:\[([^\]]+)\])?\s*[:：]\s*(.+)$/i,
      );
    if (!match) return [];
    const kind = prefixes[match[1].toLowerCase()];
    const flags = match[2] ?? "";
    return [
      {
        id: `${id}-line-${i}`,
        kind,
        label: match[3],
        level: flags.includes("record_only")
          ? ("record_only" as const)
          : flags.includes("recommended")
            ? ("recommended" as const)
            : ("required" as const),
        allowsDeferral: flags.includes("deferrable"),
        ...(topicId ? { topicId } : {}),
        ...(kind === "action"
          ? {
              requireOwner: !flags.includes("owner optional"),
              requireDeadline: !flags.includes("deadline optional"),
            }
          : {}),
      },
    ];
  });
}
export function compileGoalRequirements(
  goals: Requirement[],
  structure: MeetingStructure,
  people: Participant[],
) {
  const plain = (text: string) =>
    text
      .split("\n")
      .filter((line) => !typedLines(line, "check").length)
      .join("\n")
      .trim();
  const result = compileRequirements(
    goals.map((g) =>
      plain(g.label) ? { ...g, label: plain(g.label) } : { ...g, level: "record_only" as const },
    ),
    structure,
    people,
    [],
  );
  result.items.push(...goals.flatMap((g) => typedLines(g.label, g.id)));
  const stages =
    structure.type === "time"
      ? structure.segments
      : structure.type === "speaker"
        ? []
        : structure.stages;
  for (const stage of stages) {
    for (const goal of stage.goals.filter((g) => g.text.trim())) {
      const id = `structure-goal-${goal.id}`;
      const typed = typedLines(goal.text, id, `structure-${stage.id}`);
      if (typed.length && !plain(goal.text)) result.items = result.items.filter((r) => r.id !== id);
      else
        result.items = result.items.map((r) =>
          r.id === id
            ? {
                ...r,
                label: `${stage.name}: ${plain(goal.text)}`,
                level: "required",
                allowsDeferral: false,
              }
            : r,
        );
      result.items.push(...typed);
    }
  }
  // Participants without explicit requirements are still checked for observed input, never blockers.
  for (const p of people)
    if (
      !result.items.some(
        (r) =>
          r.kind === "speaker" &&
          (r.id.endsWith(`-${p.id}`) || r.label.split(/[（(:：]/)[0].trim() === p.name),
      )
    )
      result.items.push({
        id: `speaker-observed-${p.id}`,
        kind: "speaker",
        label: `${p.name}（${p.roleLabel ?? p.role}）`,
        builtinKey: p.roleLabel ? undefined : `${p.name}（${p.role}）`,
        level: "record_only",
        allowsDeferral: false,
      });
  return result;
}
function visibleRule(r: Requirement, label = r.label, prefix: string = r.kind): string {
  const flags = [
    r.level !== "required" ? r.level : "",
    r.allowsDeferral ? "deferrable" : "",
    r.kind === "action" && r.requireOwner === false ? "owner optional" : "",
    r.kind === "action" && r.requireDeadline === false ? "deadline optional" : "",
  ].filter(Boolean);
  return label
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => `${prefix}${flags.length ? ` [${flags.join("; ")}]` : ""}: ${line}`)
    .join("\n");
}
export function visibleTemplate(
  template: MeetingTemplate,
  t = (text: string) => text,
): MeetingTemplate {
  const kind: Record<string, string> = {
    topic: "Topic",
    conclusion: "Conclusion",
    decision: "Decision",
    action: "Action",
    speaker: "Speaker",
    agenda: "Topic",
  };
  const oldRules = template.rules.map((r) =>
    visibleRule(r, r.builtinKey === r.label ? t(r.label) : r.label, t(kind[r.kind] ?? "Topic")),
  );
  return {
    ...template,
    defaultGoals: documentGoals(
      [
        ...template.defaultGoals.map((g) => {
          const label = g.builtinKey === g.label ? t(g.label) : g.label;
          return g.level === "required" && !g.allowsDeferral
            ? label
            : visibleRule(g, label, "Goal");
        }),
        ...oldRules,
      ].join("\n"),
      template.defaultGoals[0]?.id,
    ),
    defaultStages: template.defaultStages.map((s) =>
      s.builtinKey === "Next Steps" ? { ...s, name: "Actions", builtinKey: "Actions" } : s,
    ),
    rules: [],
  };
}
export function validGoalConfiguration(
  goals: Requirement[],
  structure: MeetingStructure,
  people: Participant[],
  duration: number,
) {
  return (
    goals.length > 0 &&
    goalDocument(goals).length <= GOAL_TEXT_LIMIT &&
    goals.every((g) => g.label.trim()) &&
    validStructure(structure, duration, people) &&
    validRequirementLists(compileGoalRequirements(goals, structure, people))
  );
}
export function upgradeGoalConfiguration(m: Meeting): Meeting {
  if (m.configurationVersion === 2 || m.lifecycle !== "active") return m;
  const generated = new Set(
    compileRequirements([], m.structure, m.participants, []).items.map((r) => r.id),
  );
  const old = m.requirements.items.filter((r) => r.kind !== "goal" && !generated.has(r.id));
  // Keep old host-authored expectations visible, including legacy speaker expectations.
  const labels: Record<string, string> = {
    topic: "Topic",
    conclusion: "Conclusion",
    decision: "Decision",
    action: "Action",
    speaker: "Speaker",
    agenda: "Topic",
  };
  const text = [
    ...m.goals.map((g) => (g.level === "required" && !g.allowsDeferral ? g.label : visibleRule(g))),
    ...old.map((r) => visibleRule(r, r.label, labels[r.kind])),
  ].join("\n");
  const goals = documentGoals(text || m.title, m.goals[0]?.id);
  const structure = {
    ...m.structure,
    stages: m.structure.stages.map((s) => ({
      ...(s.builtinKey === "Next Steps" ? { ...s, name: "Actions", builtinKey: "Actions" } : s),
      goals: s.goals.map((g) => {
        const r = m.requirements.items.find((r) => r.id === `structure-goal-${g.id}`);
        return r && g.text.trim()
          ? { ...g, text: visibleRule(r, g.text), builtinKey: undefined }
          : g;
      }),
    })),
    segments: m.structure.segments.map((s) => ({
      ...s,
      goals: s.goals.map((g) => {
        const r = m.requirements.items.find((r) => r.id === `structure-goal-${g.id}`);
        return r && g.text.trim()
          ? { ...g, text: visibleRule(r, g.text), builtinKey: undefined }
          : g;
      }),
    })),
  };
  const requirements = {
    ...compileGoalRequirements(goals, structure, m.participants),
    revision: m.requirements.revision + 1,
  };
  return {
    ...m,
    goals,
    structure,
    configurationVersion: 2,
    requirements,
    migrationNote:
      text.length > GOAL_TEXT_LIMIT || !validRequirementLists(requirements)
        ? IMPORT_REVIEW_NOTE
        : m.migrationNote,
    analysis: null,
    completionCheck: null,
    summary: null,
    gapResolutions: [],
    stateRevision: m.stateRevision + 1,
    actionItems: m.actionItems
      .filter((a) => a.source === "host")
      .map((a) => ({ ...a, requirementId: undefined, gapId: undefined, evidenceIds: [] })),
  };
}
