"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, X, CalendarDays } from "lucide-react";
import { MeetingTemplate, Participant, Requirement, MeetingStructure } from "@/lib/models";
import { templates } from "@/lib/templates";
import { blankTemplate, isBuiltinTemplate } from "@/lib/custom-templates";
import { createMeeting } from "@/lib/meeting-factory";
import {
  compileRequirements,
  durationMinutes,
  reusableTemplate,
  validConfiguration,
  validParticipants,
  validSchedule,
  timezoneOffset,
} from "@/lib/meeting-structure";
import { MeetingTimePicker } from "./meeting-time-picker";
import { ParticipantInput } from "./participant-input";
import { TemplateSelection } from "./template-selection";
import { BasicInformationHeader } from "./basic-information-header";
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
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantDraft, setParticipantDraft] = useState("");
  const [selected, setSelected] = useState<MeetingTemplate | null>(null);
  const [goals, setGoals] = useState<Requirement[]>([]);
  const [structure, setStructure] = useState<MeetingStructure | null>(null);
  const [deleting, setDeleting] = useState<MeetingTemplate | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savedMessage, setSavedMessage] = useState(false);
  const duration = durationMinutes(startTime, endTime);
  const timeError =
    startTime && endTime
      ? duration <= 0
        ? "End time must be later than start time"
        : duration > 720 || duration % 5 !== 0
          ? "Enter a valid meeting time"
          : null
      : null;
  const pageOneValid =
    !!name.trim() &&
    validSchedule(date, startTime, endTime, timezone) &&
    validParticipants(participants) &&
    !participantDraft.trim();
  const valid =
    !!structure &&
    validConfiguration(goals, structure, participants, duration, selected?.rules ?? []);
  const close = () => (dirty ? setDiscard(true) : onClose());
  const choose = (template: MeetingTemplate) => {
    setSelected(template);
    setGoals(structuredClone(template.defaultGoals));
    setStructure(null);
    setTemplateName(isBuiltinTemplate(template.id) ? "" : template.name);
    setSavedMessage(false);
  };
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
        className="creation-overlay !inset-0 !h-dvh !w-full !max-w-none !translate-x-0 !translate-y-0 !rounded-none border-0 p-0"
      >
        <div className="flex h-full flex-col" onChangeCapture={() => setDirty(true)}>
          <DialogHeader className="border-b px-4 py-4 sm:px-6 lg:px-8">
            {page <= 2 ? (
              <BasicInformationHeader onClose={close} step={page as 1 | 2} />
            ) : (
              <div className="flex w-full items-center justify-between">
                <DialogTitle>
                  {tx("Create Meeting")}{" "}
                  <span className="ml-3 text-xs font-normal text-muted-foreground">{page} / 3</span>
                </DialogTitle>
                <Button variant="ghost" size="icon" aria-label={tx("Close")} onClick={close}>
                  <X size={18} />
                </Button>
              </div>
            )}
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-7 sm:px-6 lg:px-8">
            <div
              key={page}
              className={`flow-enter w-full min-w-0 space-y-7 ${page <= 2 ? "mx-auto max-w-4xl sm:py-5" : ""}`}
            >
              {page === 1 && (
                <>
                  <h2 className="text-2xl font-semibold">{tx("Basic Information")}</h2>
                  <label className="block">
                    <span className="field-label">{tx("Meeting name")}</span>
                    <Input
                      autoFocus
                      required
                      placeholder={tx("e.g. Product strategy review")}
                      maxLength={140}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <fieldset className="space-y-3">
                    <legend className="sr-only">{tx("Meeting Time")}</legend>
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
                      <MeetingTimePicker
                        label={tx("Start time")}
                        value={startTime}
                        invalid={!!timeError}
                        describedBy={timeError ? "meeting-time-error" : undefined}
                        onChange={(value) => {
                          setDirty(true);
                          setStart(value);
                          setStructure(null);
                        }}
                      />
                      <MeetingTimePicker
                        label={tx("End time")}
                        value={endTime}
                        invalid={!!timeError}
                        describedBy={timeError ? "meeting-time-error" : undefined}
                        onChange={(value) => {
                          setDirty(true);
                          setEnd(value);
                          setStructure(null);
                        }}
                      />
                    </div>
                    {timeError && (
                      <p id="meeting-time-error" role="alert" className="text-sm text-destructive">
                        {tx(timeError)}
                      </p>
                    )}
                    <label className="block pt-3">
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
                      {timezoneOffset(timezone, date, startTime)}
                    </p>
                  </fieldset>
                  <ParticipantInput
                    participants={participants}
                    draft={participantDraft}
                    onDraftChange={(value) => {
                      setParticipantDraft(value);
                      setDirty(true);
                    }}
                    onChange={(people) => {
                      setDirty(true);
                      setParticipants(people);
                      setStructure(null);
                    }}
                  />
                </>
              )}
              {page === 2 && (
                <TemplateSelection
                  templates={[...templates, ...customTemplates]}
                  selected={selected}
                  onSelect={choose}
                  onDelete={setDeleting}
                  onCreate={() => {
                    choose(blankTemplate());
                    setStructure(null);
                  }}
                />
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
                  <section className="border-t pt-4">
                    <h2 className="text-lg font-semibold">{tx("Meeting Rules")}</h2>
                    <MeetingRulesEditor
                      rules={selected.rules}
                      onChange={(rules) => setSelected({ ...selected, rules })}
                    />
                  </section>
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
          <footer className="border-t bg-white px-4 py-4 sm:px-6 lg:px-8">
            <div
              className={`flex w-full gap-3 ${page === 1 ? "mx-auto max-w-4xl justify-end" : page === 2 ? "mx-auto max-w-4xl justify-between" : "justify-between"}`}
            >
              {page !== 1 && (
                <Button
                  variant={page === 2 ? "outline" : "ghost"}
                  onClick={() => (page === 1 ? close() : setPage(page - 1))}
                >
                  <ArrowLeft size={16} />
                  {tx(page === 1 ? "Back to Home" : "Back")}
                </Button>
              )}
              <Button
                disabled={page === 1 ? !pageOneValid : page === 2 ? !selected : !valid}
                onClick={() => {
                  if (page === 3) finish();
                  else {
                    setPage(page + 1);
                  }
                }}
              >
                {tx(page === 3 ? "Create Meeting" : "Continue")}
                {page <= 2 && <ArrowRight size={16} />}
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
