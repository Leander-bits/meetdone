"use client";
import { ActionItem, Gap, Meeting } from "@/lib/models";
import { useI18n } from "./language-provider";
export function useMeetingPresentation(meeting: Meeting) {
  const { t, label } = useI18n();
  function gapTitle(gap: Gap) {
    if (gap.type.startsWith("action_")) {
      const action = meeting.actionItems.find((a) => gap.id.endsWith(`:${a.id}`));
      if (action?.description.trim()) return actionTitle(action);
    }
    const r = meeting.requirements.items.find((r) => r.id === gap.requirementId);
    return r ? label(r) : t(gap.title);
  }
  function actionTitle(action: ActionItem) {
    const r = meeting.requirements.items.find((r) => r.id === action.requirementId);
    return action.source === "demo" && r && r.label === action.description
      ? label(r)
      : action.description;
  }
  function gapDescription(gap: Gap) {
    if (gap.type === "unresolved_issue") return gap.explanation;
    const shortReasons: Partial<Record<Gap["type"], string>> = {
      goal_uncovered: "Not sufficiently covered.",
      conclusion_missing: "No conclusion recorded.",
      topic_uncovered: "Not sufficiently covered.",
      speaker_missing: "No relevant input recorded.",
      decision_missing: "No decision recorded.",
      decision_pending: "Discussed, not decided",
      action_missing: gap.explanation.includes("has no description")
        ? gap.explanation
        : "No action item recorded.",
      action_owner: "Assign an owner.",
      action_deadline: "Set a deadline.",
    };
    return t(shortReasons[gap.type] ?? gap.explanation);
  }
  return { gapTitle, gapDescription, actionTitle };
}
