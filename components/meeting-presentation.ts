"use client";
import { ActionItem, Gap, Meeting } from "@/lib/models";
import { useI18n } from "./language-provider";
export function useMeetingPresentation(meeting: Meeting) {
  const { t, label } = useI18n();
  function gapTitle(gap: Gap) {
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
    const match = gap.explanation.match(/^“(.*)” (has no (?:owner|valid deadline|deadline)\.)$/);
    if (!match) return t(gap.explanation);
    const action = meeting.actionItems.find((a) => a.description === match[1]);
    return t(`“{description}” ${match[2]}`, {
      description: action ? actionTitle(action) : match[1],
    });
  }
  return { gapTitle, gapDescription, actionTitle };
}
