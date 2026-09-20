import { ActionItem, Gap, Meeting } from "./models";
import { Locale, translate, requirementLabel } from "./i18n";

export function meetingPresentation(meeting: Meeting, locale: Locale) {
  const t = (key: string) => translate(locale, key);
  const label = (r: Meeting["requirements"]["items"][number]) => requirementLabel(locale, r);
  function actionTitle(action: ActionItem) {
    const r = meeting.requirements.items.find((r) => r.id === action.requirementId);
    return action.source === "demo" && r && r.label === action.description
      ? label(r)
      : action.description;
  }
  function gapTitle(gap: Gap) {
    if (gap.type.startsWith("action_")) {
      const action = meeting.actionItems.find((a) => gap.id.endsWith(`:${a.id}`));
      if (action?.description.trim()) return actionTitle(action);
    }
    const r = meeting.requirements.items.find((r) => r.id === gap.requirementId);
    const stage = r?.id.startsWith("speaker-structure-")
      ? meeting.requirements.items.find((topic) => topic.id === r.topicId)
      : undefined;
    if (r && stage) return `${label(r)} · ${label(stage)}`;
    return r ? label(r) : t(gap.title);
  }
  function gapDescription(gap: Gap) {
    if (gap.type === "unresolved_issue") return gap.explanation;
    const reasons: Partial<Record<Gap["type"], string>> = {
      goal_uncovered: "Not sufficiently covered.",
      conclusion_missing: "No conclusion recorded.",
      topic_uncovered: "Not sufficiently covered.",
      speaker_missing: "No relevant input recorded.",
      decision_missing: "No decision recorded.",
      decision_pending: "Discussed, not decided",
      action_missing: "No action item recorded.",
      action_owner: gap.severity === "FOLLOW_UP" ? "Owner not specified." : "Assign an owner.",
      action_deadline: gap.severity === "FOLLOW_UP" ? "Deadline not specified." : "Set a deadline.",
    };
    return t(reasons[gap.type] ?? gap.explanation);
  }
  return { actionTitle, gapTitle, gapDescription };
}
