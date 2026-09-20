"use client";
import { useMeetingPresentation } from "./meeting-presentation";
import { useI18n } from "@/components/language-provider";
import { Plus, Trash2 } from "lucide-react";
import { ActionItem, Meeting } from "@/lib/models";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { EvidenceList } from "./shared";
import { evaluateMeeting } from "@/lib/meeting-state";
import { validDeadline } from "@/lib/rule-engine";

export function ActionItems({
  meeting: m,
  onChange,
  disabled: busy = false,
}: {
  meeting: Meeting;
  disabled?: boolean;
  onChange: (items: ActionItem[]) => void;
}) {
  const { t: tx, label } = useI18n();
  const { actionTitle } = useMeetingPresentation(m);
  const blockingGaps = evaluateMeeting(m).blockingGaps;
  const blocks = (id: string, type: "action_owner" | "action_deadline") =>
    blockingGaps.some((g) => g.type === type && g.id.endsWith(`:${id}`));

  const disabled = busy || m.lifecycle !== "active";
  const patch = (id: string, change: Partial<ActionItem>) =>
    onChange(m.actionItems.map((a) => (a.id === id ? { ...a, ...change, source: "host" } : a)));
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        {!disabled && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onChange([
                ...m.actionItems,
                {
                  id: crypto.randomUUID(),
                  description: tx("New action item"),
                  owner: "",
                  deadline: "",
                  status: "open",
                  source: "host",
                  evidenceIds: [],
                },
              ])
            }
          >
            <Plus size={14} />
            {tx("Add action")}
          </Button>
        )}
      </div>
      {m.actionItems.length === 0 && (
        <p className="text-sm text-muted-foreground">{tx("No action items captured.")}</p>
      )}
      <div className="space-y-4">
        {m.actionItems.map((a, i) => (
          <section className="border-t py-4 first:border-0 first:pt-0" key={a.id}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {tx("Action")}
                  {String(i + 1).padStart(2, "0")}
                </span>
                {a.gapId && (
                  <span className="text-xs text-muted-foreground">{tx("Linked to gap")}</span>
                )}
              </div>
              {!disabled && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${tx("Delete action")} ${i + 1}`}
                  onClick={() => onChange(m.actionItems.filter((item) => item.id !== a.id))}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
            <label className="block">
              <span className="field-label">{tx("Description")}</span>
              <Input
                disabled={disabled}
                aria-label={`${tx("Action")} ${i + 1} ${tx("Description")}`}
                value={actionTitle(a)}
                onChange={(e) => patch(a.id, { description: e.target.value })}
              />
            </label>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label>
                <span className="field-label">
                  {tx("Owner")}
                  {!(a.owner ?? "").trim() && (
                    <span
                      className={
                        blocks(a.id, "action_owner") ? "text-destructive" : "text-muted-foreground"
                      }
                    >
                      {" "}
                      · {tx(blocks(a.id, "action_owner") ? "Missing" : "Not specified")}
                    </span>
                  )}
                </span>
                <Input
                  aria-label={`${tx("Action")} ${i + 1} ${tx("Owner")}`}
                  disabled={disabled}
                  value={a.owner ?? ""}
                  placeholder={tx("Assign a person")}
                  onChange={(e) => patch(a.id, { owner: e.target.value })}
                />
              </label>
              <label>
                <span className="field-label">
                  {tx("Deadline")}
                  {!validDeadline(a.deadline) && (
                    <span
                      className={
                        blocks(a.id, "action_deadline")
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }
                    >
                      {" "}
                      · {tx(blocks(a.id, "action_deadline") ? "Missing" : "Not specified")}
                    </span>
                  )}
                </span>
                <Input
                  aria-label={`${tx("Action")} ${i + 1} ${tx("Deadline")}`}
                  disabled={disabled}
                  type="date"
                  value={a.deadline ?? ""}
                  onChange={(e) => patch(a.id, { deadline: e.target.value })}
                />
              </label>
              <label>
                <span className="field-label">{tx("Status")}</span>
                <select
                  aria-label={`${tx("Action")} ${i + 1} ${tx("Status")}`}
                  disabled={disabled}
                  className="native-select"
                  value={a.status}
                  onChange={(e) => patch(a.id, { status: e.target.value as ActionItem["status"] })}
                >
                  <option value="unknown">{tx("Unknown")}</option>
                  <option value="open">{tx("Open")}</option>
                  <option value="in_progress">{tx("In progress")}</option>
                  <option value="done">{tx("Done")}</option>
                </select>
              </label>
            </div>
            <details className="mt-3 text-xs text-muted-foreground">
              <summary className="w-fit">{tx("Required action output")}</summary>
              <label className="mt-2 block">
                <span className="field-label">{tx("Required action output")}</span>
                <select
                  aria-label={`${tx("Action")} ${i + 1} ${tx("Required action output")}`}
                  className="native-select"
                  disabled={disabled || !!a.gapId}
                  value={a.requirementId ?? ""}
                  onChange={(e) => patch(a.id, { requirementId: e.target.value || undefined })}
                >
                  <option value="">{tx("Additional follow-up")}</option>
                  {m.requirements.items
                    .filter((r) => r.kind === "action")
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {label(r)}
                      </option>
                    ))}
                </select>
              </label>
            </details>
            <EvidenceList ids={a.evidenceIds} evidence={m.analysis?.evidence ?? []} />
          </section>
        ))}
      </div>
    </div>
  );
}
