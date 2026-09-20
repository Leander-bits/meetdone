"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { Meeting } from "@/lib/models";
import {
  applyAnalysis,
  convertGap,
  endMeeting,
  evaluateMeeting,
  prepareMeeting,
  updateActionItems,
  updateRequirements,
} from "@/lib/meeting-state";
import {
  compileRequirements,
  durationMinutes,
  validConfiguration,
  scheduleText,
} from "@/lib/meeting-structure";
import { MeetingRequirementsView } from "./meeting-requirements";
import { orderedRequirements, requirementDisplay } from "@/lib/requirement-display";
import { finalEvaluation } from "@/lib/final-evaluation";
import { downloadSummary } from "@/lib/summary-download";
import { getTemplate } from "@/lib/templates";
import { useI18n } from "./language-provider";
import { useWorkspace } from "./workspace-store";
import { AppHeader, EvidenceList, LoadingWorkspace, Notice, meetingStatus } from "./shared";
import { TranscriptPanel } from "./transcript-panel";
import { coverageFor } from "@/lib/coverage";
import { ActionItems } from "./action-items";
import { GapCheck } from "./gap-check";
import { MeetingSummaryView } from "./meeting-summary";
import { MeetingRulesEditor } from "./meeting-rules-editor";
import { MeetingGoalsEditor, StructureEditor } from "./structure-editor";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";

function EditConfiguration({
  meeting: m,
  save,
  close,
}: {
  meeting: Meeting;
  save: (m: Meeting) => boolean;
  close: () => void;
}) {
  const { t: tx } = useI18n();
  const [title, setTitle] = useState(m.builtinTitle ? tx(m.title) : m.title);
  const [goals, setGoals] = useState(structuredClone(m.goals));
  const [structure, setStructure] = useState(structuredClone(m.structure));
  const [people, setPeople] = useState(structuredClone(m.participants));
  const [rules, setRules] = useState(() =>
    m.requirements.items.filter(
      (r) => r.kind !== "goal" && !r.id.startsWith("structure-") && !r.id.startsWith("speaker-"),
    ),
  );
  const duration = durationMinutes(m.startTime, m.endTime);
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        aria-describedby={undefined}
        className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-4xl"
      >
        <DialogHeader>
          <DialogTitle>{tx("Meeting Requirements")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 overflow-y-auto pr-1">
          <label className="block">
            <span className="field-label">{tx("Meeting name")}</span>
            <Input value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <MeetingGoalsEditor goals={goals} onChange={setGoals} />
          <StructureEditor
            structure={structure}
            onChange={setStructure}
            participants={people}
            onParticipantsChange={setPeople}
            duration={duration || 30}
            template={getTemplate(m.templateId)}
          />
          <section>
            <h2 className="text-lg font-semibold">{tx("Meeting Rules")}</h2>
            <MeetingRulesEditor rules={rules} onChange={setRules} />
          </section>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            {tx("Cancel")}
          </Button>
          <Button
            disabled={
              !title.trim() || !validConfiguration(goals, structure, people, duration || 30, rules)
            }
            onClick={() => {
              const updated = {
                ...updateRequirements(m, compileRequirements(goals, structure, people, rules)),
                goals,
                structure,
                participants: people,
                title:
                  title.trim() === (m.builtinTitle ? tx(m.title) : m.title)
                    ? m.title
                    : title.trim(),
                builtinTitle:
                  title.trim() === (m.builtinTitle ? tx(m.title) : m.title)
                    ? m.builtinTitle
                    : false,
              };
              if (save(updated)) close();
            }}
          >
            {tx("Save requirements")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MeetingWorkspace({ id }: { id: string }) {
  const { t: tx, label, title, locale } = useI18n();
  const { loaded, meetings, warning, updateMeeting } = useWorkspace();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actionsRef = useRef<HTMLDetailsElement>(null);
  if (!loaded) return <LoadingWorkspace />;
  const m = meetings.find((m) => m.id === id);
  if (!m)
    return (
      <>
        <AppHeader />
        <main className="mx-auto max-w-xl p-8">
          <h1>{tx("Meeting not found in this browser")}</h1>
          <Link href="/">{tx("Back")}</Link>
        </main>
      </>
    );
  const ended = m.lifecycle !== "active";
  const check = evaluateMeeting(m);
  const nextSpeaker = m.structure.speakerOrder
    .map((id) =>
      m.requirements.items.find((r) => r.id === `speaker-all-${id}` && r.level === "required"),
    )
    .find((r) => r && !coverageFor(m, r).complete);
  const perform = (fn: (m: Meeting) => Meeting) => {
    try {
      updateMeeting(id, fn);
      setError(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Changes could not be saved.");
      return false;
    }
  };
  const showActions = () => {
    if (actionsRef.current) {
      actionsRef.current.open = true;
      actionsRef.current.scrollIntoView({ block: "center" });
    }
  };
  const continueDiscussion = () => {
    document.getElementById("transcript")?.focus();
    document.getElementById("transcript")?.scrollIntoView({ block: "center" });
  };
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl px-5 py-6">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowLeft size={15} />
          {tx("Back")}
        </Link>
        <header className="mb-7 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="break-words text-2xl font-semibold">{title(m)}</h1>
            <p className="mt-2 text-xs text-muted-foreground">
              {scheduleText(m) ?? tx("Schedule not recorded")}
            </p>
          </div>
          <p
            role="status"
            className={`text-sm font-semibold ${m.analysis && !pending && check.readiness === "READY" ? "text-primary" : "text-muted-foreground"}`}
          >
            {tx(meetingStatus(m, pending))}
          </p>
        </header>
        {warning && <Notice error>{warning}</Notice>}
        {error && <Notice error>{error}</Notice>}
        {m.migrationNote && <Notice>{m.migrationNote}</Notice>}
        {ended ? (
          <MeetingSummaryView meeting={m} />
        ) : (
          <>
            <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <div className="min-w-0">
                <TranscriptPanel
                  meeting={m}
                  update={perform}
                  pending={pending}
                  onPendingChange={setPending}
                  onAnalysis={(analysis, revision) =>
                    perform((current) => applyAnalysis(current, analysis, revision))
                  }
                />
              </div>
              <section className="min-w-0" aria-labelledby="requirements-heading">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h2 id="requirements-heading" className="section-title">
                    {tx("Meeting Requirements")}
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => setEditing(true)}
                  >
                    {tx("Edit")}
                  </Button>
                </div>
                <MeetingRequirementsView meeting={m} />
              </section>
            </div>
            {m.analysis && !pending && (
              <section
                id="analysis-results"
                aria-labelledby="analysis-heading"
                className="flow-enter mt-9 border-t pt-7"
              >
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <h2 id="analysis-heading" className="text-xl font-semibold">
                    {tx("AI Analysis")}
                  </h2>
                  <p
                    className={`font-semibold ${check.readiness === "READY" ? "text-primary" : "text-destructive"}`}
                  >
                    {tx(meetingStatus(m))}
                    {check.blockingGaps.length > 0 &&
                      ` · ${tx("{count} issues", { count: check.blockingGaps.length })}`}
                  </p>
                </div>
                <h3 className="mb-3 font-semibold">{tx("Requirement Evaluation")}</h3>
                <div className="divide-y">
                  {orderedRequirements(m.requirements.items)
                    .filter((r) => r.level !== "record_only")
                    .map((r) => {
                      const c = coverageFor(m, r);
                      return (
                        <div key={r.id} className={`px-3 py-3 ${c.complete ? "bg-primary/5" : ""}`}>
                          <div className="flex items-start justify-between gap-4">
                            <p
                              className={`min-w-0 break-words text-sm ${c.complete ? "font-medium text-primary" : ""}`}
                            >
                              {c.complete && <Check size={14} className="mr-2 inline" />}
                              {requirementDisplay(m, r, tx, label)}
                            </p>
                            <span
                              className={`shrink-0 text-xs ${c.complete ? "text-primary" : "text-muted-foreground"}`}
                            >
                              {tx(c.label)}
                            </span>
                          </div>
                          <EvidenceList ids={c.evidenceIds} evidence={m.analysis!.evidence} />
                        </div>
                      );
                    })}
                </div>
                {m.structure.type === "speaker" && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {tx("Next required speaker")}:{" "}
                    {nextSpeaker ? label(nextSpeaker) : tx("Complete")}
                  </p>
                )}
                <section className="mt-7">
                  <h3 className="mb-3 font-semibold">{tx("Final Meeting Evaluation")}</h3>
                  <ul className="space-y-3">
                    {finalEvaluation(m).map((answer) => (
                      <li
                        key={answer.question}
                        className="flex items-start justify-between gap-4 text-sm"
                      >
                        <span>{tx(answer.question)}</span>
                        <span
                          className={`shrink-0 text-xs ${answer.problem ? "text-amber-800" : "text-primary"}`}
                        >
                          {tx(answer.answer ? "Yes" : "No")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
                <details ref={actionsRef} className="my-6 border-y py-3">
                  <summary className="text-sm">
                    {tx("Action Items")} ({m.actionItems.length})
                  </summary>
                  <div className="mt-4">
                    <ActionItems
                      meeting={m}
                      onChange={(items) => perform((current) => updateActionItems(current, items))}
                    />
                  </div>
                </details>
                <h3 className="mb-4 font-semibold">
                  {tx(check.blockingGaps.length ? "Blocking Issues" : "Ready to End")}
                </h3>
                <GapCheck
                  meeting={m}
                  check={check}
                  prepared
                  onContinue={continueDiscussion}
                  onActions={showActions}
                  onConvert={(gap, action) => {
                    if (perform((current) => convertGap(current, gap, action))) showActions();
                  }}
                  onEnd={(reason) => {
                    let finished: Meeting | undefined;
                    if (
                      perform((current) => {
                        finished = endMeeting(prepareMeeting(current), reason);
                        return finished;
                      }) &&
                      finished
                    ) {
                      downloadSummary(finished, locale);
                      window.scrollTo(0, 0);
                    }
                  }}
                />
              </section>
            )}
          </>
        )}
      </main>
      {editing && (
        <EditConfiguration
          meeting={m}
          close={() => setEditing(false)}
          save={(updated) => perform(() => updated)}
        />
      )}
    </>
  );
}
