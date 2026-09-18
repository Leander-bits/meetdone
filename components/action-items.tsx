"use client";
import { useMeetingPresentation } from "./meeting-presentation";
import { useI18n } from "@/components/language-provider";
import { Plus, Trash2 } from "lucide-react";
import { ActionItem, Meeting } from "@/lib/models";
import { validDeadline } from "@/lib/rule-engine";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { EvidenceList, Notice, StatusBadge } from "./shared";

export function ActionItems({
  meeting: m,
  onChange,
}: {
  meeting: Meeting;
  onChange: (items: ActionItem[]) => void;
}) {
  const { t: tx, label } = useI18n();
  const { actionTitle } = useMeetingPresentation(m);

  const disabled = m.lifecycle !== "active";
  const patch = (id: string, change: Partial<ActionItem>) =>
    onChange(m.actionItems.map((a) => (a.id === id ? { ...a, ...change, source: "host" } : a)));
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="section-title">{tx("Action items")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {tx("A clear commitment has an owner and a deadline.")}
          </p>
        </div>
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
        <Notice>
          {tx(
            "No action items yet. Analyze a transcript or add an action linked to a required output.",
          )}
        </Notice>
      )}
      <div className="space-y-4">
        {m.actionItems.map((a, i) => (
          <section className="surface p-5" key={a.id}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="eyebrow">
                  {tx("Action")}
                  {String(i + 1).padStart(2, "0")}
                </span>
                <StatusBadge
                  tone={
                    a.description.trim() && (a.owner ?? "").trim() && validDeadline(a.deadline)
                      ? "good"
                      : "warn"
                  }
                >
                  {a.description.trim() && (a.owner ?? "").trim() && validDeadline(a.deadline)
                    ? tx("Assigned")
                    : tx("Incomplete commitment")}
                </StatusBadge>
                {a.gapId && <StatusBadge>{tx("Linked to gap")}</StatusBadge>}
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
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label>
                <span className="field-label">
                  {tx("Owner")}
                  {!(a.owner ?? "").trim() && (
                    <span className="text-destructive">· {tx("Missing")}</span>
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
                  {!a.deadline && <span className="text-destructive">· {tx("Missing")}</span>}
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
            <label className="mt-4 block">
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
            {a.gapId && (
              <p className="mt-3 break-all text-xs text-muted-foreground">
                {tx("Follow-up for")}: {a.gapId}.{" "}
                {tx("The link is preserved even if the gap is resolved.")}
              </p>
            )}
            <div className="mt-3 text-[11px] text-muted-foreground">
              {a.source === "demo"
                ? tx("Extracted from demo transcript")
                : a.source === "ai"
                  ? tx("Extracted by AI")
                  : tx("Added or edited by host")}
            </div>
            <EvidenceList ids={a.evidenceIds} evidence={m.analysis?.evidence ?? []} />
          </section>
        ))}
      </div>
    </div>
  );
}
