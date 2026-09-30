"use client";
import { ArrowRight, Star, Trash2 } from "lucide-react";
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
  sequence = false,
}: {
  group: string;
  assignments: Stage["assignments"];
  participants: Participant[];
  onParticipantsChange: (participants: Participant[]) => void;
  onRequiredChange: (id: string, required: boolean) => void;
  onMove: (from: number, to: number) => void;
  onRemove?: (id: string) => void;
  sequence?: boolean;
}) {
  const { t: tx, locale } = useI18n();
  return (
    <div
      className={`speaker-flow-container ${sequence ? "speaker-sequence" : ""}`}
      data-speaker-flow-group={group}
    >
      <SortableList ids={assignments.map((a) => `${group}/${a.participantId}`)} onMove={onMove}>
        <div className="speaker-flow" data-speaker-flow>
          {assignments.map((assignment, i) => {
            const id = assignment.participantId;
            const p = participants.find((p) => p.id === id);
            return (
              p && (
                <SortableRow key={id} id={`${group}/${id}`} index={i} flow>
                  <div
                    className={`speaker-node mx-auto flex items-center justify-center rounded-full border-2 p-2 text-center text-sm font-medium break-words transition-colors ${sequence ? "h-20 w-20" : "h-24 w-24"} ${assignment.required ? (sequence ? "border-primary bg-primary text-primary-foreground" : "border-primary/60 bg-primary/5") : "border-border bg-white"}`}
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
                  <div
                    className={`mx-auto mt-3 flex max-w-full flex-col gap-2 ${sequence ? "w-32" : "w-36"}`}
                  >
                    <select
                      aria-label={`${tx("Role")}: ${p.name}`}
                      className={`native-select !text-xs ${sequence ? "!rounded-lg !bg-card" : ""}`}
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
                      className={`flex cursor-pointer items-center justify-center gap-2 px-2 py-1 text-xs ${sequence ? "relative min-h-8 rounded-full border focus-within:ring-2 focus-within:ring-ring" : "rounded"} ${assignment.required ? `${sequence ? "border-primary/40" : ""} bg-primary/10 text-primary` : `${sequence ? "border-border bg-card" : ""} text-muted-foreground`}`}
                    >
                      <input
                        type="checkbox"
                        className={
                          sequence
                            ? "absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            : "accent-primary"
                        }
                        checked={assignment.required}
                        onChange={(e) => onRequiredChange(id, e.target.checked)}
                      />
                      {sequence && (
                        <Star
                          size={12}
                          aria-hidden="true"
                          className={assignment.required ? "fill-primary" : ""}
                        />
                      )}
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
