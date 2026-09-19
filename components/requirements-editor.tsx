"use client";
import { Plus, Trash2 } from "lucide-react";
import { MeetingRequirements, Requirement, kindLabels, requirementKinds } from "@/lib/models";
import { MAX_REQUIREMENTS, minimumKinds, removeRequirement } from "@/lib/requirements";
import { useI18n } from "./language-provider";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function RequirementsEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: MeetingRequirements;
  onChange: (r: MeetingRequirements) => void;
  disabled?: boolean;
}) {
  const { t: tx, label } = useI18n();
  const patch = (id: string, change: Partial<Requirement>) =>
    onChange({ ...value, items: value.items.map((r) => (r.id === id ? { ...r, ...change } : r)) });
  const groupView = (group: Requirement["kind"]) => {
    const items = value.items.filter((r) => r.kind === group);
    return (
      <section key={group} aria-label={tx(kindLabels[group])} className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">{tx(kindLabels[group])}</h3>
          {!disabled && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={value.items.length >= MAX_REQUIREMENTS}
              aria-label={`${tx("Add item")}: ${tx(kindLabels[group])}`}
              onClick={() =>
                onChange({
                  ...value,
                  items: [
                    ...value.items,
                    {
                      id: crypto.randomUUID(),
                      kind: group,
                      label: "",
                      level: group === "agenda" ? "record_only" : "required",
                      allowsDeferral: false,
                    },
                  ],
                })
              }
            >
              <Plus size={13} />
              {tx("Add item")}
            </Button>
          )}
        </div>
        {items.map((r, i) => (
          <div key={r.id} className="space-y-1.5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
              <Input
                maxLength={500}
                disabled={disabled}
                aria-label={`${tx(kindLabels[group])} ${i + 1}`}
                value={label(r)}
                placeholder={tx("Describe the requirement")}
                onChange={(e) => patch(r.id, { label: e.target.value, builtinKey: undefined })}
                className="col-span-2 min-w-0 bg-white text-sm sm:col-span-1"
              />
              <select
                className="native-select"
                aria-label={`${tx("Requirement level")}: ${label(r)}`}
                disabled={disabled}
                value={r.level}
                onChange={(e) => patch(r.id, { level: e.target.value as Requirement["level"] })}
              >
                <option value="required">{tx("Required")}</option>
                <option value="recommended">{tx("Recommended")}</option>
                <option value="record_only">{tx("Record only")}</option>
              </select>
              <Button
                type="button"
                disabled={disabled || (minimumKinds.includes(group) && items.length <= 1)}
                variant="ghost"
                size="icon"
                aria-label={`${tx("Remove")}: ${tx(kindLabels[group])} ${i + 1}`}
                title={
                  minimumKinds.includes(group) && items.length <= 1
                    ? tx("At least one item is required.")
                    : tx("Remove")
                }
                onClick={() => onChange(removeRequirement(value, r.id))}
              >
                <Trash2 size={14} />
              </Button>
            </div>
            <details className="text-xs text-muted-foreground">
              <summary className="w-fit">{tx("Options")}</summary>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {r.kind === "speaker" && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    {tx("Opinion on")}
                    <select
                      className="native-select h-7 max-w-60 text-xs"
                      aria-label={`${tx("Topics")}: ${label(r)}`}
                      disabled={disabled}
                      value={r.topicId ?? ""}
                      onChange={(e) => patch(r.id, { topicId: e.target.value || undefined })}
                    >
                      <option value="">{tx("Any meeting topic")}</option>
                      {value.items
                        .filter((item) => item.kind === "topic")
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {label(item)}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                {r.level !== "record_only" && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={r.allowsDeferral}
                      onChange={(e) => patch(r.id, { allowsDeferral: e.target.checked })}
                      className="accent-primary"
                    />
                    {tx("Allow deferral to an owned, dated action")}
                  </label>
                )}
              </div>
            </details>
          </div>
        ))}
      </section>
    );
  };
  return (
    <div className="space-y-5">
      {minimumKinds.map(groupView)}
      <details className="border-t pt-3">
        <summary className="text-sm font-medium">{tx("Decisions & agenda")}</summary>
        <div className="mt-4 space-y-5">
          {requirementKinds.filter((kind) => !minimumKinds.includes(kind)).map(groupView)}
        </div>
      </details>
    </div>
  );
}
