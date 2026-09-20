"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, X, CalendarDays } from "lucide-react";
import { MeetingTemplate, Participant, Requirement, MeetingStructure } from "@/lib/models";
import { templates } from "@/lib/templates";
import { blankTemplate, isBuiltinTemplate } from "@/lib/custom-templates";
import { createMeeting } from "@/lib/demo";
import {
  compileRequirements,
  displayNameFromEmail,
  durationMinutes,
  initialStructure,
  reusableTemplate,
  validConfiguration,
  validParticipants,
  validSchedule,
  timezoneOffset,
} from "@/lib/meeting-structure";
import { MeetingRulesEditor } from "./meeting-rules-editor";
import { StructureEditor, MeetingGoalsEditor } from "./structure-editor";
import { useI18n } from "./language-provider";
import { useWorkspace } from "./workspace-store";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";

export function CreateMeeting({ onClose }: { onClose: () => void }) {
  const { t: tx } = useI18n();
  const router = useRouter();
  const { saveMeeting, customTemplates, saveTemplate, deleteTemplate } = useWorkspace();
  const [page, setPage] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStart] = useState("");
  const [endTime, setEnd] = useState("");
  const [timezone, setTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  const [participants, setParticipants] = useState<Participant[]>([
    { id: crypto.randomUUID(), email: "", name: "", role: "Other" },
  ]);
  const [selected, setSelected] = useState<MeetingTemplate | null>(null);
  const [goals, setGoals] = useState<Requirement[]>([]);
  const [structure, setStructure] = useState<MeetingStructure | null>(null);
  const [deleting, setDeleting] = useState<MeetingTemplate | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savedMessage, setSavedMessage] = useState(false);
  const duration = durationMinutes(startTime, endTime);
  const pageOneValid =
    !!name.trim() &&
    validSchedule(date, startTime, endTime, timezone) &&
    validParticipants(participants);
  const valid =
    !!structure &&
    validConfiguration(goals, structure, participants, duration, selected?.rules ?? []);
  const close = () => (dirty ? setDiscard(true) : onClose());
  const choose = (template: MeetingTemplate) => {
    setSelected(template);
    setGoals(structuredClone(template.defaultGoals));
    setStructure(initialStructure(template.structureType, duration, participants, template));
    setTemplateName(isBuiltinTemplate(template.id) ? "" : template.name);
    setSavedMessage(false);
  };
  const personUpdate = (id: string, patch: Partial<Participant>) =>
    setParticipants((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  function finish() {
    if (!selected || !structure || !valid || !pageOneValid) return;
    const requirements = compileRequirements(goals, structure, participants, selected.rules);
    const meeting = {
      ...createMeeting(selected.id, crypto.randomUUID(), false, selected),
      title: name.trim(),
      builtinTitle: false,
      date,
      startTime,
      endTime,
      timezone,
      participants,
      goals,
      structure,
      requirements,
    };
    saveMeeting(meeting);
    onClose();
    router.push(`/meetings/${meeting.id}`);
  }
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        className="creation-overlay !inset-0 !h-dvh !w-screen !max-w-none !translate-x-0 !translate-y-0 !rounded-none border-0 p-0"
      >
        <div className="flex h-full flex-col" onChangeCapture={() => setDirty(true)}>
          <DialogHeader className="border-b px-5 py-4">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
              <DialogTitle>
                {tx("Create Meeting")}{" "}
                <span className="ml-3 text-xs font-normal text-muted-foreground">{page} / 3</span>
              </DialogTitle>
              <Button variant="ghost" size="icon" aria-label={tx("Close")} onClick={close}>
                <X size={18} />
              </Button>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-7">
            <div key={page} className="flow-enter mx-auto max-w-4xl space-y-7">
              {page === 1 && (
                <>
                  <h2 className="text-2xl font-semibold">{tx("Meeting details")}</h2>
                  <label className="block">
                    <span className="field-label">{tx("Meeting name")}</span>
                    <Input
                      autoFocus
                      required
                      maxLength={140}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <fieldset className="space-y-3">
                    <legend className="field-label">{tx("Meeting Time")}</legend>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label>
                        <span className="field-label flex items-center gap-1">
                          <CalendarDays size={14} />
                          {tx("Date")}
                        </span>
                        <Input
                          type="date"
                          required
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                        />
                      </label>
                      <label>
                        <span className="field-label">{tx("Start time")}</span>
                        <Input
                          type="time"
                          step={300}
                          required
                          value={startTime}
                          onChange={(e) => {
                            setStart(e.target.value);
                            setStructure(null);
                          }}
                        />
                      </label>
                      <label>
                        <span className="field-label">{tx("End time")}</span>
                        <Input
                          type="time"
                          step={300}
                          required
                          value={endTime}
                          onChange={(e) => {
                            setEnd(e.target.value);
                            setStructure(null);
                          }}
                        />
                      </label>
                    </div>
                    <label className="block max-w-sm">
                      <span className="field-label">{tx("Timezone")}</span>
                      <select
                        aria-label={tx("Timezone")}
                        className="native-select"
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                      >
                        {[...new Set([timezone, "UTC", ...Intl.supportedValuesOf("timeZone")])].map(
                          (z) => (
                            <option key={z}>{z}</option>
                          ),
                        )}
                      </select>
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {timezoneOffset(timezone, date, startTime) && (
                        <span>
                          {timezoneOffset(timezone, date, startTime)} {"\u00b7"}{" "}
                        </span>
                      )}
                      {tx("Same-day meeting · 5-minute increments · up to 12 hours")}
                    </p>
                  </fieldset>
                  <fieldset>
                    <legend className="mb-3 text-sm font-semibold">{tx("Participants")}</legend>
                    <div className="space-y-3">
                      {participants.map((p, i) => (
                        <div key={p.id} className="flex items-end gap-2">
                          <div className="grid flex-1 gap-2 sm:grid-cols-2">
                            <label>
                              <span className="field-label">
                                {tx("Email")} {i + 1}
                              </span>
                              <Input
                                type="email"
                                value={p.email}
                                onChange={(e) =>
                                  personUpdate(p.id, {
                                    email: e.target.value,
                                    ...(!p.name || p.name === displayNameFromEmail(p.email)
                                      ? { name: displayNameFromEmail(e.target.value) }
                                      : {}),
                                  })
                                }
                              />
                            </label>
                            <label>
                              <span className="field-label">
                                {tx("Display name")} {i + 1}
                              </span>
                              <Input
                                value={p.name}
                                maxLength={100}
                                onChange={(e) => personUpdate(p.id, { name: e.target.value })}
                              />
                            </label>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={participants.length === 1}
                            aria-label={`${tx("Remove participant")} ${i + 1}`}
                            onClick={() => {
                              setDirty(true);
                              setParticipants(participants.filter((x) => x.id !== p.id));
                              setStructure(null);
                            }}
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      className="mt-3"
                      variant="ghost"
                      size="sm"
                      disabled={participants.length >= 30}
                      onClick={() => {
                        setDirty(true);
                        setParticipants([
                          ...participants,
                          { id: crypto.randomUUID(), email: "", name: "", role: "Other" },
                        ]);
                        setStructure(null);
                      }}
                    >
                      <Plus size={15} />
                      {tx("Add participant")}
                    </Button>
                  </fieldset>
                </>
              )}
              {page === 2 && (
                <>
                  <h2 className="text-2xl font-semibold">{tx("Choose a template")}</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[...templates, ...customTemplates].map((template) => (
                      <div
                        key={template.id}
                        className={`relative rounded-xl border-2 transition-colors ${selected?.id === template.id ? "border-primary bg-primary/5" : "border-transparent bg-white"}`}
                      >
                        <button
                          className="min-h-32 w-full p-6 text-left text-base font-medium"
                          aria-pressed={selected?.id === template.id}
                          onClick={() => choose(template)}
                        >
                          {isBuiltinTemplate(template.id) ? tx(template.name) : template.name}
                        </button>
                        {!isBuiltinTemplate(template.id) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-2"
                            aria-label={`${tx("Delete Custom Template")}: ${template.name}`}
                            onClick={() => setDeleting(template)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    ))}
                    <button
                      className={`min-h-32 rounded-xl border-2 border-dashed p-6 text-left font-medium ${selected && ![...templates, ...customTemplates].some((t) => t.id === selected.id) ? "border-primary bg-primary/5" : "border-muted-foreground/30"}`}
                      onClick={() => {
                        choose(blankTemplate());
                        setStructure(null);
                      }}
                    >
                      <Plus className="mb-3" size={22} />
                      {tx("Create New Template")}
                    </button>
                  </div>
                </>
              )}
              {page === 3 && selected && (
                <>
                  <MeetingGoalsEditor goals={goals} onChange={setGoals} />
                  <StructureEditor
                    structure={structure}
                    onChange={setStructure}
                    participants={participants}
                    onParticipantsChange={setParticipants}
                    duration={duration}
                    template={selected}
                  />
                  <details className="border-t pt-4">
                    <summary className="text-sm text-muted-foreground">
                      {tx("Reusable rules")}
                    </summary>
                    <MeetingRulesEditor
                      rules={selected.rules}
                      onChange={(rules) => setSelected({ ...selected, rules })}
                    />
                  </details>
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!valid}
                      onClick={() => setSavingTemplate(!savingTemplate)}
                    >
                      {tx("Save as Template")}
                    </Button>
                    {savedMessage && (
                      <span className="ml-3 text-sm text-primary">{tx("Template saved.")}</span>
                    )}
                    {savingTemplate && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Input
                          aria-label={tx("Template name")}
                          className="max-w-sm"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                        />
                        <Button
                          disabled={!templateName.trim() || !valid}
                          onClick={() => {
                            if (!structure) return;
                            const id = isBuiltinTemplate(selected.id)
                              ? `custom-${crypto.randomUUID()}`
                              : selected.id;
                            const t = reusableTemplate(id, templateName.trim(), {
                              goals,
                              structure,
                              participants,
                              requirements: compileRequirements(
                                goals,
                                structure,
                                participants,
                                selected.rules,
                              ),
                            });
                            saveTemplate(t);
                            setSelected(t);
                            setSavingTemplate(false);
                            setSavedMessage(true);
                          }}
                        >
                          {tx("Save Template")}
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          <footer className="border-t bg-white px-5 py-4">
            <div className="mx-auto flex max-w-5xl justify-between gap-3">
              <Button variant="ghost" onClick={() => (page === 1 ? close() : setPage(page - 1))}>
                <ArrowLeft size={16} />
                {tx(page === 1 ? "Back to Home" : "Back")}
              </Button>
              <Button
                disabled={page === 1 ? !pageOneValid : page === 2 ? !selected : !valid}
                onClick={() => {
                  if (page === 3) finish();
                  else {
                    if (page === 2 && selected && !structure)
                      setStructure(
                        initialStructure(selected.structureType, duration, participants, selected),
                      );
                    setPage(page + 1);
                  }
                }}
              >
                {tx(page === 3 ? "Create Meeting" : "Continue")}
              </Button>
            </div>
          </footer>
        </div>
      </DialogContent>
      <Dialog open={discard} onOpenChange={setDiscard}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{tx("Discard this meeting?")}</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscard(false)}>
              {tx("Cancel")}
            </Button>
            <Button variant="destructive" onClick={onClose}>
              {tx("Discard")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{tx("Delete this template?")}</DialogTitle>
          </DialogHeader>
          <p>{deleting?.name}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {tx("Cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) {
                  deleteTemplate(deleting.id);
                  if (selected?.id === deleting.id) setSelected(null);
                }
                setDeleting(null);
              }}
            >
              {tx("Delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
