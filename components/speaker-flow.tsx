"use client";
import { ArrowRight, Trash2 } from "lucide-react";
import { Participant, Stage } from "@/lib/models";
import { useI18n } from "./language-provider";
import { SortableList, SortableRow } from "./sortable";
import { Button } from "./ui/button";

// A role belongs to the participant; required input and ordering belong to this flow.
export function SpeakerFlow({
  group,
  assignments,
  participants,
  onParticipantsChange,
  onRequiredChange,
  onMove,
  onRemove,
}: {
  group: string;
  assignments: Stage["assignments"];
  participants: Participant[];
  onParticipantsChange: (participants: Participant[]) => void;
  onRequiredChange: (id: string, required: boolean) => void;
  onMove: (from: number, to: number) => void;
  onRemove?: (id: string) => void;
}) {
  const { t: tx, locale } = useI18n();
  return (
    <div className="speaker-flow-container" data-speaker-flow-group={group}>
      <SortableList ids={assignments.map((a) => `${group}/${a.participantId}`)} onMove={onMove}>
        <div className="speaker-flow" data-speaker-flow>
          {assignments.map((assignment, i) => {
            const id = assignment.participantId;
            const p = participants.find((p) => p.id === id);
            return (
              p && (
                <SortableRow key={id} id={`${group}/${id}`} index={i} flow>
                  <div
                    className={`speaker-node mx-auto flex h-24 w-24 items-center justify-center rounded-full border-2 p-2 text-center text-sm font-medium break-words ${assignment.required ? "border-primary/60 bg-primary/5" : "border-border bg-white"}`}
                    data-speaker-node
                    title={p.name}
                  >
                    <span className="line-clamp-3 break-all">{p.name}</span>
                  </div>
                  {i < assignments.length - 1 && (
                    <ArrowRight
                      data-speaker-arrow
                      data-from={id}
                      data-to={assignments[i + 1].participantId}
                      aria-hidden="true"
                      className="speaker-arrow absolute text-muted-foreground/60"
                      size={18}
                    />
                  )}
                  <div className="mx-auto mt-3 flex w-36 max-w-full flex-col gap-2">
                    <select
                      aria-label={`${tx("Role")}: ${p.name}`}
                      className="native-select !text-xs"
                      value={p.role}
                      onChange={(e) =>
                        onParticipantsChange(
                          participants.map((x) =>
                            x.id === id
                              ? {
                                  ...x,
                                  role: e.target.value as Participant["role"],
                                  roleLabel: undefined,
                                }
                              : x,
                          ),
                        )
                      }
                    >
                      {["Product", "Engineering", "Sales", "Customer", "Other"].map((role) => (
                        <option key={role} value={role}>
                          {tx(role)}
                        </option>
                      ))}
                    </select>
                    <label
                      className={`flex items-center justify-center gap-2 rounded px-2 py-1 text-xs ${assignment.required ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
                    >
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={assignment.required}
                        onChange={(e) => onRequiredChange(id, e.target.checked)}
                      />
                      {locale === "zh" ? tx("Must speak") : tx("Required")}
                    </label>
                  </div>
                  {onRemove && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-0 h-8 w-8"
                      aria-label={`${tx("Remove participant")}: ${p.name}`}
                      title={`${tx("Remove participant")}: ${p.name}`}
                      onClick={() => onRemove(id)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  )}
                </SortableRow>
              )
            );
          })}
        </div>
      </SortableList>
    </div>
  );
}
