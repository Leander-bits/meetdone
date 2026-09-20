"use client";
import { Plus, Trash2 } from "lucide-react";
import { Requirement, kindLabels } from "@/lib/models";
import { useI18n } from "./language-provider";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { DeferralToggle, ItemNumber } from "./requirement-controls";
import { ruleKinds } from "@/lib/requirement-display";

export function MeetingRulesEditor({
  rules,
  onChange,
}: {
  rules: Requirement[];
  onChange: (rules: Requirement[]) => void;
}) {
  const { t: tx, label } = useI18n();
  const patch = (id: string, value: Partial<Requirement>) =>
    onChange(rules.map((r) => (r.id === id ? { ...r, ...value } : r)));
  return (
    <div className="mt-4 space-y-5">
      {ruleKinds.map((kind) => (
        <fieldset key={kind}>
          <legend className="mb-2 text-sm font-medium">{tx(kindLabels[kind])}</legend>
          <div className="space-y-2">
            {rules
              .filter((r) => r.kind === kind)
              .map((r, i) => (
                <div key={r.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <ItemNumber index={i} />
                    <Input
                      aria-label={`${tx(kindLabels[kind])} ${i + 1}`}
                      className="min-w-40 flex-1"
                      maxLength={500}
                      value={label(r)}
                      onChange={(e) =>
                        patch(r.id, { label: e.target.value, builtinKey: undefined })
                      }
                    />
                    <select
                      aria-label={`${tx("Requirement level")}: ${tx(kindLabels[kind])} ${i + 1}`}
                      className="native-select !w-32"
                      value={r.level}
                      onChange={(e) =>
                        patch(r.id, { level: e.target.value as Requirement["level"] })
                      }
                    >
                      <option value="required">{tx("Required")}</option>
                      <option value="recommended">{tx("Recommended")}</option>
                      <option value="record_only">{tx("Record only")}</option>
                    </select>
                    <DeferralToggle
                      enabled={r.allowsDeferral}
                      onChange={(allowsDeferral) => patch(r.id, { allowsDeferral })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${tx("Remove")}: ${tx(kindLabels[kind])} ${i + 1}`}
                      onClick={() => onChange(rules.filter((x) => x.id !== r.id))}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={rules.length >= 30}
            onClick={() =>
              onChange([
                ...rules,
                {
                  id: crypto.randomUUID(),
                  kind,
                  label: "",
                  level: "required",
                  allowsDeferral: false,
                },
              ])
            }
          >
            <Plus size={13} />
            {tx("Add item")}
          </Button>
        </fieldset>
      ))}
    </div>
  );
}
