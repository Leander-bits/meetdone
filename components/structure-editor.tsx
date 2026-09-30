"use client";
import { GOAL_TEXT_LIMIT, goalDocument, documentGoals } from "@/lib/goal-configuration";
import { useState } from "react";
import { Clock3, Users, ListOrdered, Grid2X2, Plus, Trash2, Check } from "lucide-react";
import {
  GoalInput,
  MeetingStructure,
  MeetingTemplate,
  Participant,
  Requirement,
  Stage,
  structureTypes,
} from "@/lib/models";
import {
  addSegment,
  initialStructure,
  roleIsRequired,
  moveItem,
  resizeSegment,
  removeSegment,
  structureNames,
} from "@/lib/meeting-structure";
import { useI18n } from "./language-provider";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { SortableList, SortableRow } from "./sortable";
import { SpeakerFlow } from "./speaker-flow";
import { ItemNumber } from "./requirement-controls";

export function MeetingGoalsEditor({
  goals,
  onChange,
  creationLayout = false,
}: {
  goals: Requirement[];
  onChange: (goals: Requirement[]) => void;
  creationLayout?: boolean;
}) {
  const { t, label } = useI18n();
  return (
    <section className={creationLayout ? "mx-auto w-full max-w-4xl" : undefined}>
      <label className="block">
        <span className="mb-3 block text-lg font-semibold">{t("Meeting Goals")}</span>
        <Textarea
          aria-label={t("Meeting Goals")}
          className="min-h-48 rounded-xl bg-card p-4 leading-7 placeholder:text-muted-foreground/60"
          maxLength={GOAL_TEXT_LIMIT}
          value={goalDocument(goals, label)}
          placeholder={t("Meeting goal prompt")}
          onChange={(e) => onChange(documentGoals(e.target.value, goals[0]?.id))}
        />
      </label>
    </section>
  );
}

function StructureGoals({
  goals,
  onChange,
  light = false,
}: {
  goals: GoalInput[];
  onChange: (goals: GoalInput[]) => void;
  light?: boolean;
}) {
  const { t: tx } = useI18n();
  return (
    <div className={light ? "mt-2" : "mt-3"}>
      <p className="text-xs text-muted-foreground">
        {tx("Goals")}{" "}
        {goals.filter((g) => g.text.trim()).length > 0 &&
          `(${goals.filter((g) => g.text.trim()).length})`}
      </p>
      <div className="mt-2 space-y-2">
        {goals.map((g, i) => (
          <div key={g.id} className="flex gap-1">
            <ItemNumber index={i} letters />
            <Input
              aria-label={`${tx("Goal")} ${i + 1}`}
              placeholder={tx(
                [
                  "e.g. Confirm launch risks",
                  "e.g. Review customer feedback",
                  "e.g. Decide whether to release",
                ][i % 3],
              )}
              className={`placeholder:text-muted-foreground/60 ${light ? "border-transparent bg-transparent shadow-none hover:border-input focus-visible:border-ring" : ""}`}
              maxLength={500}
              value={g.builtinKey === g.text ? tx(g.text) : g.text}
              onChange={(e) =>
                onChange(
                  goals.map((x) =>
                    x.id === g.id ? { ...x, text: e.target.value, builtinKey: undefined } : x,
                  ),
                )
              }
            />
            {i > 0 && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${tx("Remove goal")} ${i + 1}`}
                onClick={() => onChange(goals.filter((x) => x.id !== g.id))}
              >
                <Trash2 size={14} />
              </Button>
            )}
          </div>
        ))}
      </div>
      <Button
        variant="ghost"
        size="icon"
        title={tx("Add Goal")}
        aria-label={tx("Add Goal")}
        disabled={goals.length >= 5}
        onClick={() => onChange([...goals, { id: crypto.randomUUID(), text: "" }])}
      >
        <Plus size={14} />
      </Button>
    </div>
  );
}

export function StructureEditor({
  structure: s,
  onChange,
  participants,
  onParticipantsChange,
  duration,
  template,
  creationLayout = false,
}: {
  structure: MeetingStructure | null;
  onChange: (s: MeetingStructure) => void;
  participants: Participant[];
  onParticipantsChange: (p: Participant[]) => void;
  duration: number;
  template?: MeetingTemplate;
  creationLayout?: boolean;
}) {
  const { t: tx } = useI18n();
  const icons = { time: Clock3, speaker: Users, stages: ListOrdered, matrix: Grid2X2 };
  const [selectedPerson, setSelectedPerson] = useState("");
  const stageUpdate = (id: string, patch: Partial<Stage>) => {
    if (s) onChange({ ...s, stages: s.stages.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  };
  const assign = (stageId: string, participantId: string) => {
    const stage = s?.stages.find((x) => x.id === stageId);
    if (
      stage &&
      participants.some((p) => p.id === participantId) &&
      !stage.assignments.some((a) => a.participantId === participantId)
    )
      stageUpdate(stageId, {
        assignments: [
          ...stage.assignments,
          {
            participantId,
            required: roleIsRequired(
              template,
              participants.find((p) => p.id === participantId)!.role,
              stageId,
            ),
          },
        ],
      });
  };
  return (
    <section className="space-y-5">
      <h2 className={`text-lg font-semibold ${creationLayout ? "mx-auto w-full max-w-4xl" : ""}`}>
        {tx("Meeting Structure")}
      </h2>
      <div
        className={
          creationLayout
            ? "mx-auto grid w-full max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2"
            : "grid grid-cols-2 gap-3 sm:grid-cols-4"
        }
        data-structure-selector
      >
        {structureTypes.map((type) => {
          const Icon = icons[type];
          return (
            <button
              key={type}
              aria-pressed={s?.type === type}
              onClick={() =>
                onChange(
                  s ? { ...s, type } : initialStructure(type, duration, participants, template),
                )
              }
              className={`${creationLayout ? "relative flex min-h-20 items-center gap-3 px-5 py-4 pr-10 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : "flex min-h-28 flex-col items-center justify-center gap-3 px-3 py-4 text-center"} rounded-xl border-2 text-sm font-medium transition-colors ${s?.type === type ? "border-primary bg-primary/5 text-primary" : creationLayout ? "border-border bg-card hover:border-primary/50" : "border-transparent bg-white hover:border-border"}`}
            >
              <Icon
                size={creationLayout ? 22 : 27}
                strokeWidth={1.5}
                className="shrink-0"
                aria-hidden="true"
              />
              {tx(structureNames[type])}
              {creationLayout && s?.type === type && (
                <Check size={16} aria-hidden="true" className="absolute right-4" />
              )}
            </button>
          );
        })}
      </div>
      {s?.type === "time" && (
        <div
          className="flow-enter space-y-4 rounded-xl border bg-muted/30 p-4 sm:p-5"
          data-structure-editor="time"
        >
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <Clock3 size={16} />
              {tx("Timeline")}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {duration} {tx("minutes")}
            </span>
          </div>
          <div className="flex h-10 gap-0.5 overflow-hidden rounded-lg" aria-label={tx("Timeline")}>
            {s.segments.map((seg, i) => (
              <div
                key={seg.id}
                className={`flex min-w-0 items-center justify-center px-1 text-xs ${i % 2 ? "bg-primary/20" : "bg-primary/10"}`}
                style={{ flex: seg.minutes }}
                title={`${seg.builtinKey === seg.name ? tx(seg.name) : seg.name}: ${seg.minutes}`}
              >
                <span className="truncate">
                  {i + 1}. {seg.builtinKey === seg.name ? tx(seg.name) : seg.name}
                </span>
              </div>
            ))}
          </div>
          <div
            className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3"
            data-timeline-cards
          >
            <SortableList
              ids={s.segments.map((seg) => `segments/${seg.id}`)}
              onMove={(from, to) => onChange({ ...s, segments: moveItem(s.segments, from, to) })}
            >
              {s.segments.map((seg, i) => (
                <SortableRow key={seg.id} id={`segments/${seg.id}`} index={i} card>
                  <div className="space-y-3">
                    <Input
                      className="font-semibold"
                      aria-label={`${tx("Segment")} ${i + 1}`}
                      value={seg.builtinKey === seg.name ? tx(seg.name) : seg.name}
                      onChange={(e) =>
                        onChange({
                          ...s,
                          segments: s.segments.map((x) =>
                            x.id === seg.id
                              ? { ...x, name: e.target.value, builtinKey: undefined }
                              : x,
                          ),
                        })
                      }
                    />
                    <span className="flex items-center gap-1.5 text-sm tabular-nums text-muted-foreground">
                      <Clock3 size={14} aria-hidden="true" />
                      {seg.minutes} {tx("minutes")}
                    </span>
                    <input
                      className="block h-5 w-full cursor-ew-resize accent-primary focus-visible:outline-2 focus-visible:outline-primary"
                      aria-label={`${tx("Duration")} ${i + 1}`}
                      type="range"
                      min={5}
                      max={duration - (s.segments.length - 1) * 5}
                      step={5}
                      value={seg.minutes}
                      onChange={(e) =>
                        onChange({
                          ...s,
                          segments: resizeSegment(s.segments, seg.id, Number(e.target.value)),
                        })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-3 top-4"
                      disabled={s.segments.length === 1}
                      aria-label={`${tx("Remove segment")} ${i + 1}`}
                      onClick={() =>
                        onChange({ ...s, segments: removeSegment(s.segments, seg.id) })
                      }
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                  <StructureGoals
                    goals={seg.goals}
                    onChange={(goals) =>
                      onChange({
                        ...s,
                        segments: s.segments.map((x) => (x.id === seg.id ? { ...x, goals } : x)),
                      })
                    }
                  />
                </SortableRow>
              ))}
            </SortableList>
            <Button
              variant="outline"
              className="h-auto min-h-36 w-full flex-col gap-2 rounded-xl border-2 border-dashed bg-transparent text-primary hover:border-primary/60"
              disabled={!s.segments.some((x) => x.minutes >= 10)}
              onClick={() =>
                onChange({
                  ...s,
                  segments: addSegment(s.segments, tx("New segment"), crypto.randomUUID()),
                })
              }
            >
              <Plus size={14} />
              {tx("Add segment")}
            </Button>
          </div>
        </div>
      )}
      {s?.type === "speaker" && (
        <div
          className="flow-enter speaker-flow-container space-y-4 rounded-xl border bg-muted/30 p-4 sm:p-5"
          data-structure-editor="speaker"
        >
          <SpeakerFlow
            sequence
            group="speakers"
            assignments={s.speakerOrder.map((id) => ({
              participantId: id,
              required: s.requiredSpeakerIds.includes(id),
            }))}
            participants={participants}
            onParticipantsChange={onParticipantsChange}
            onMove={(from, to) =>
              onChange({ ...s, speakerOrder: moveItem(s.speakerOrder, from, to) })
            }
            onRequiredChange={(id, required) =>
              onChange({
                ...s,
                requiredSpeakerIds: required
                  ? [...s.requiredSpeakerIds, id]
                  : s.requiredSpeakerIds.filter((x) => x !== id),
              })
            }
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ ...s, speakerOrder: participants.map((p) => p.id) })}
          >
            {tx("Reset order")}
          </Button>
        </div>
      )}
      {(s?.type === "stages" || s?.type === "matrix") && (
        <div
          className={`flow-enter space-y-3 ${s.type === "stages" ? "rounded-xl border bg-muted/30 p-3 sm:p-5" : ""}`}
          data-structure-editor={s.type}
        >
          {s.type === "matrix" && (
            <>
              <p className="text-xs font-medium text-muted-foreground">{tx("Participants")}</p>
              <div className="flex flex-wrap gap-2">
                {participants.map((p) => (
                  <button
                    key={p.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/meetdone-participant", p.id);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => setSelectedPerson(p.id)}
                    aria-pressed={selectedPerson === p.id}
                    className={`cursor-grab rounded-full border px-3 py-2 text-xs transition-colors ${selectedPerson === p.id ? "border-primary bg-primary/10" : "bg-white"}`}
                  >
                    {p.name}（{p.roleLabel ?? tx(p.role)}）
                  </button>
                ))}
              </div>
            </>
          )}
          <SortableList
            ids={s.stages.map((stage) => `stages/${stage.id}`)}
            onMove={(from, to) => onChange({ ...s, stages: moveItem(s.stages, from, to) })}
          >
            {s.stages.map((stage, i) => (
              <SortableRow
                key={stage.id}
                id={`stages/${stage.id}`}
                index={i}
                section={s.type === "matrix"}
                stage={s.type === "stages"}
              >
                <div
                  onDragOver={(e) => {
                    if (e.dataTransfer.types.includes("application/meetdone-participant"))
                      e.preventDefault();
                  }}
                  onDrop={(e) => {
                    const id = e.dataTransfer.getData("application/meetdone-participant");
                    if (id) {
                      e.preventDefault();
                      e.stopPropagation();
                      assign(stage.id, id);
                    }
                  }}
                  className="min-h-12"
                  data-matrix-stage={s.type === "matrix" ? stage.id : undefined}
                >
                  <div
                    className={
                      s.type === "matrix"
                        ? "mb-3 flex gap-2 rounded-lg bg-muted/50 p-2"
                        : "flex gap-2"
                    }
                  >
                    <Input
                      className={
                        s.type === "matrix"
                          ? "border-transparent bg-transparent !text-base font-semibold shadow-none hover:border-input focus-visible:border-ring"
                          : "border-transparent bg-transparent font-semibold shadow-none hover:border-input focus-visible:border-ring"
                      }
                      aria-label={`${tx("Stage")} ${i + 1}`}
                      value={stage.builtinKey === stage.name ? tx(stage.name) : stage.name}
                      maxLength={100}
                      onChange={(e) =>
                        stageUpdate(stage.id, { name: e.target.value, builtinKey: undefined })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={s.stages.length === 1}
                      aria-label={`${tx("Remove stage")} ${i + 1}`}
                      onClick={() =>
                        onChange({ ...s, stages: s.stages.filter((x) => x.id !== stage.id) })
                      }
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                  <StructureGoals
                    light
                    goals={stage.goals}
                    onChange={(goals) => stageUpdate(stage.id, { goals })}
                  />
                  {s.type === "matrix" && (
                    <div className="mt-4 space-y-4 border-t pt-4">
                      <SpeakerFlow
                        sequence
                        group={stage.id}
                        assignments={stage.assignments}
                        participants={participants}
                        onParticipantsChange={onParticipantsChange}
                        onMove={(from, to) =>
                          stageUpdate(stage.id, {
                            assignments: moveItem(stage.assignments, from, to),
                          })
                        }
                        onRequiredChange={(id, required) =>
                          stageUpdate(stage.id, {
                            assignments: stage.assignments.map((a) =>
                              a.participantId === id ? { ...a, required } : a,
                            ),
                          })
                        }
                        onRemove={(id) =>
                          stageUpdate(stage.id, {
                            assignments: stage.assignments.filter((a) => a.participantId !== id),
                          })
                        }
                      />
                      <div className="flex flex-wrap gap-2">
                        <select
                          className="native-select !w-auto max-w-full !rounded-full !border-dashed !text-xs"
                          aria-label={`${tx("Assign participant")}: ${stage.builtinKey === stage.name ? tx(stage.name) : stage.name}`}
                          value=""
                          onChange={(e) => assign(stage.id, e.target.value)}
                        >
                          <option value="">+ {tx("Add participant")}</option>
                          {participants
                            .filter((p) => !stage.assignments.some((a) => a.participantId === p.id))
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                        </select>
                        {selectedPerson &&
                          !stage.assignments.some((a) => a.participantId === selectedPerson) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => assign(stage.id, selectedPerson)}
                            >
                              {tx("Add selected participant")}
                            </Button>
                          )}
                      </div>
                    </div>
                  )}
                </div>
              </SortableRow>
            ))}
          </SortableList>
          <div className="flex flex-col items-start gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="min-h-12 w-full rounded-xl border-2 border-dashed text-primary hover:border-primary/60"
              disabled={s.stages.length >= 15}
              onClick={() => {
                const id = crypto.randomUUID();
                onChange({
                  ...s,
                  stages: [
                    ...s.stages,
                    {
                      id,
                      name: tx("New stage"),
                      custom: true,
                      goals: [{ id: `${id}-goal`, text: "" }],
                      assignments: [],
                    },
                  ],
                });
              }}
            >
              <Plus size={14} />
              {tx("Add stage")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const defaults = initialStructure(
                  "stages",
                  duration,
                  participants,
                  template,
                ).stages.map((x) => x.id);
                onChange({
                  ...s,
                  stages: [...s.stages].sort(
                    (a, b) =>
                      (defaults.includes(a.id) ? defaults.indexOf(a.id) : 999) -
                      (defaults.includes(b.id) ? defaults.indexOf(b.id) : 999),
                  ),
                });
              }}
            >
              {tx("Reset stage order")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
