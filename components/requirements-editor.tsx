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
  return (
    <div className="space-y-6">
      {requirementKinds.map((group) => {
        const items = value.items.filter((r) => r.kind === group);
        return (
          <section key={group} aria-label={tx(kindLabels[group])} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="eyebrow">{tx(kindLabels[group])}</h3>
              {!disabled && (
                <Button
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
              <div key={r.id} className="rounded-lg border bg-background/50 p-3">
                <div className="flex flex-wrap items-start gap-2">
                  <Input
                    maxLength={500}
                    disabled={disabled}
                    aria-label={`${tx(kindLabels[group])} ${i + 1}`}
                    value={label(r)}
                    placeholder={tx("Describe the requirement")}
                    onChange={(e) => patch(r.id, { label: e.target.value, builtinKey: undefined })}
                    className="min-w-40 flex-1 bg-white text-sm"
                  />
                  <select
                    className="native-select w-36"
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
                <div className="mt-2 flex flex-wrap items-center gap-3">
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
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
