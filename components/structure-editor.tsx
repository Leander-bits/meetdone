"use client";
import { useState } from "react";
import { Clock3, Users, ListOrdered, Grid2X2, Plus, Trash2 } from "lucide-react";
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
import { SortableList, SortableRow } from "./sortable";
import { SpeakerFlow } from "./speaker-flow";
import { ItemNumber } from "./requirement-controls";

export function MeetingGoalsEditor({
  goals,
  onChange,
}: {
  goals: Requirement[];
  onChange: (goals: Requirement[]) => void;
}) {
  const { t: tx, label } = useI18n();
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{tx("Meeting Goals")}</h2>
      <div className="space-y-2">
        {goals.map((g, i) => (
          <div key={g.id} className="flex gap-2">
            <ItemNumber index={i} />
            <Input
              aria-label={`${tx("Goal")} ${i + 1}`}
              value={label(g)}
              maxLength={500}
              onChange={(e) =>
                onChange(
                  goals.map((x) =>
                    x.id === g.id ? { ...x, label: e.target.value, builtinKey: undefined } : x,
                  ),
                )
              }
            />
            <select
              aria-label={`${tx("Requirement level")} ${i + 1}`}
              className="native-select !w-32 shrink-0"
              value={g.level}
              onChange={(e) =>
                onChange(
                  goals.map((x) =>
                    x.id === g.id ? { ...x, level: e.target.value as Requirement["level"] } : x,
                  ),
                )
              }
            >
              <option value="required">{tx("Required")}</option>
              <option value="recommended">{tx("Recommended")}</option>
              <option value="record_only">{tx("Record only")}</option>
            </select>
            <Button
              variant="ghost"
              size="icon"
              disabled={i === 0}
              aria-label={`${tx("Remove goal")} ${i + 1}`}
              onClick={() => onChange(goals.filter((x) => x.id !== g.id))}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
      </div>
      <Button
        className="mt-2"
        size="icon"
        title={tx("Add Goal")}
        aria-label={tx("Add Goal")}
        variant="ghost"
        disabled={goals.length >= 20}
        onClick={() =>
          onChange([
            ...goals,
            {
              id: crypto.randomUUID(),
              kind: "goal",
              label: "",
              level: "required",
              allowsDeferral: false,
            },
          ])
        }
      >
        <Plus size={14} />
      </Button>
    </section>
  );
}

function StructureGoals({
  goals,
  onChange,
}: {
  goals: GoalInput[];
  onChange: (goals: GoalInput[]) => void;
}) {
  const { t: tx } = useI18n();
  return (
    <div className="mt-3">
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
              className="placeholder:text-muted-foreground/60"
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
}: {
  structure: MeetingStructure | null;
  onChange: (s: MeetingStructure) => void;
  participants: Participant[];
  onParticipantsChange: (p: Participant[]) => void;
  duration: number;
  template?: MeetingTemplate;
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
      <h2 className="text-lg font-semibold">{tx("Meeting Structure")}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
              className={`flex min-h-28 flex-col items-center justify-center gap-3 rounded-xl border-2 px-3 py-4 text-center text-sm font-medium transition-colors ${s?.type === type ? "border-primary bg-primary/5 text-primary" : "border-transparent bg-white hover:border-border"}`}
            >
              <Icon size={27} strokeWidth={1.5} />
              {tx(structureNames[type])}
            </button>
          );
        })}
      </div>
      {s?.type === "time" && (
        <div className="flow-enter space-y-3" data-structure-editor="time">
          <div className="flex justify-between text-sm">
            <span>{tx("Timeline")}</span>
            <span>
              {duration} {tx("minutes")}
            </span>
          </div>
          <div className="flex h-12 gap-0.5 overflow-hidden rounded-md" aria-label={tx("Timeline")}>
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
          <SortableList
            ids={s.segments.map((seg) => `segments/${seg.id}`)}
            onMove={(from, to) => onChange({ ...s, segments: moveItem(s.segments, from, to) })}
          >
            {s.segments.map((seg, i) => (
              <SortableRow key={seg.id} id={`segments/${seg.id}`} index={i}>
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    className="max-w-56"
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
                  <span className="text-sm tabular-nums">
                    {seg.minutes} {tx("minutes")}
                  </span>
                  <input
                    className="min-w-24 flex-1 accent-primary"
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
                    disabled={s.segments.length === 1}
                    aria-label={`${tx("Remove segment")} ${i + 1}`}
                    onClick={() => onChange({ ...s, segments: removeSegment(s.segments, seg.id) })}
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
            variant="ghost"
            size="sm"
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
      )}
      {s?.type === "speaker" && (
        <div
          className="flow-enter speaker-flow-container space-y-3"
          data-structure-editor="speaker"
        >
          <SpeakerFlow
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
        <div className="flow-enter space-y-3" data-structure-editor={s.type}>
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
                  <div className="flex gap-2">
                    <Input
                      className={s.type === "matrix" ? "!text-base font-semibold" : undefined}
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
                    goals={stage.goals}
                    onChange={(goals) => stageUpdate(stage.id, { goals })}
                  />
                  {s.type === "matrix" && (
                    <div className="mt-3 space-y-2">
                      <SpeakerFlow
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
                          className="native-select !w-auto max-w-full"
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
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
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
