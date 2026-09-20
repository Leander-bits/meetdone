import { Meeting, Requirement, requirementKey, actionValidation } from "./models";
import { validDeadline } from "./rule-engine";

export function coverageFor(
  m: Meeting,
  r: Requirement,
): { label: string; complete: boolean; evidenceIds: string[]; detail?: string } {
  if (!m.analysis) return { label: "Not analyzed", complete: false, evidenceIds: [] };
  const match = (f: { requirementId: string; requirementKey: string }) =>
    f.requirementId === r.id && f.requirementKey === requirementKey(r, m.requirements.items);
  if (r.kind === "action") {
    const items = m.actionItems.filter((a) => a.requirementId === r.id);
    const { requireOwner, requireDeadline } = actionValidation(r);
    const complete =
      !!items.length &&
      items.every(
        (a) =>
          !!a.description.trim() &&
          (!requireOwner || !!a.owner?.trim()) &&
          (!requireDeadline || validDeadline(a.deadline)),
      );
    return {
      label: !items.length ? "Missing" : complete ? "Complete" : "Partial",
      complete,
      evidenceIds: items.flatMap((a) => a.evidenceIds),
    };
  }
  if (r.kind === "decision") {
    const f = m.analysis.decisions.find(match);
    return {
      label:
        f?.status === "decided"
          ? "Decided"
          : f?.status === "discussed"
            ? "Discussed, not decided"
            : "Missing",
      complete: f?.status === "decided",
      evidenceIds: f?.evidenceIds ?? [],
      detail: f?.detail,
    };
  }
  if (r.kind === "speaker") {
    const f = m.analysis.speakers.find(match);
    return {
      label:
        f?.status === "opinion"
          ? "Complete"
          : f?.status === "mentioned"
            ? "Mentioned only"
            : "Missing",
      complete: f?.status === "opinion",
      evidenceIds: f?.evidenceIds ?? [],
      detail: f?.detail,
    };
  }
  const list =
    r.kind === "goal"
      ? m.analysis.goals
      : r.kind === "conclusion"
        ? m.analysis.conclusions
        : m.analysis.topics;
  const f = list.find(match);
  return {
    label: f?.status === "complete" ? "Complete" : f?.status === "partial" ? "Partial" : "Missing",
    complete: f?.status === "complete",
    evidenceIds: f?.evidenceIds ?? [],
    detail: f?.detail,
  };
}
