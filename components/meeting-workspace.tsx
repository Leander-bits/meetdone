"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Meeting, MeetingRequirements } from "@/lib/models";
import {
  applyAnalysis,
  convertGap,
  endMeeting,
  evaluateMeeting,
  prepareMeeting,
  updateActionItems,
  updateRequirements,
} from "@/lib/meeting-state";
import { useI18n } from "./language-provider";
import { useWorkspace } from "./workspace-store";
import { AppHeader, LoadingWorkspace, Notice, meetingStatus } from "./shared";
import { TranscriptPanel } from "./transcript-panel";
import { Coverage, coverageFor } from "./coverage";
import { ActionItems } from "./action-items";
import { GapCheck } from "./gap-check";
import { MeetingSummaryView } from "./meeting-summary";
import { RequirementsEditor } from "./requirements-editor";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";

function EditRequirements({
  meeting: m,
  save,
  onClose,
}: {
  meeting: Meeting;
  save: (title: string, r: MeetingRequirements, builtinTitle: boolean) => boolean;
  onClose: () => void;
}) {
  const { t: tx } = useI18n();
  const [title, setTitle] = useState(m.title);
  const [builtinTitle, setBuiltinTitle] = useState(!!m.builtinTitle);
  const [draft, setDraft] = useState(structuredClone(m.requirements));
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        <DialogHeader className="px-5 py-4">
          <DialogTitle>{tx("Requirements")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 overflow-y-auto px-5 pb-5">
          <label className="block">
            <span className="field-label">{tx("Meeting name")}</span>
            <Input
              value={builtinTitle ? tx(title) : title}
              maxLength={140}
              onChange={(e) => {
                setTitle(e.target.value);
                setBuiltinTitle(false);
              }}
            />
          </label>
          <RequirementsEditor value={draft} onChange={setDraft} />
        </div>
        <DialogFooter className="border-t px-5 py-4">
          <Button variant="ghost" onClick={onClose}>
            {tx("Cancel")}
          </Button>
          <Button
            disabled={!title.trim() || draft.items.some((r) => !r.label.trim())}
            onClick={() => {
              if (save(title.trim(), draft, builtinTitle)) onClose();
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
  const { t: tx, label, title: meetingTitle } = useI18n();
  const { loaded, meetings, warning, updateMeeting, resetDemo } = useWorkspace();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [preparedRevision, setPreparedRevision] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const statusRef = useRef<HTMLElement>(null);
  const actionsRef = useRef<HTMLDetailsElement>(null);
  if (!loaded) return <LoadingWorkspace />;
  const m = meetings.find((m) => m.id === id);
  if (!m)
    return (
      <>
        <AppHeader />
        <main className="mx-auto max-w-xl space-y-4 p-8">
          <h1 className="section-title">{tx("Meeting not found in this browser")}</h1>
          <Button asChild>
            <Link href="/">{tx("Back to meetings")}</Link>
          </Button>
        </main>
      </>
    );
  const ended = m.lifecycle !== "active";
  const check = evaluateMeeting(m);
  const status = meetingStatus(m, pending);
  const required = m.requirements.items.filter(
    (r) => r.level === "required" && r.kind !== "agenda",
  );
  const covered = required.filter((r) => coverageFor(m, r).complete).length;
  const perform = (operation: (meeting: Meeting) => Meeting, message?: string) => {
    try {
      updateMeeting(id, operation);
      setError(null);
      setNotice(message ?? null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the meeting.");
      return false;
    }
  };
  const showActions = () => {
    if (actionsRef.current) {
      actionsRef.current.open = true;
      actionsRef.current.scrollIntoView({ block: "start" });
    }
  };
  const requirementsView = (
    <section className="border-b pb-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="section-title">{tx("Requirements")}</h2>
        {!ended && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setEditing(true)}>
            {tx("Edit requirements")}
          </Button>
        )}
      </div>
      <p className="text-sm leading-6">
        {m.requirements.items
          .filter((r) => r.kind === "goal")
          .map(label)
          .join("; ")}
      </p>
      <details className="mt-3">
        <summary className="w-fit text-xs text-muted-foreground">
          {tx("View requirements")} ({m.requirements.items.filter((r) => r.kind !== "goal").length})
        </summary>
        <ul className="mt-3 space-y-2 text-sm">
          {m.requirements.items
            .filter((r) => r.kind !== "goal")
            .map((r) => (
              <li key={r.id} className="flex justify-between gap-3">
                <span className="min-w-0 break-words">{label(r)}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {tx(
                    r.level === "required"
                      ? "Required"
                      : r.level === "recommended"
                        ? "Recommended"
                        : "Record only",
                  )}
                </span>
              </li>
            ))}
        </ul>
      </details>
    </section>
  );
  const transcriptView = (
    <TranscriptPanel
      meeting={m}
      update={perform}
      pending={pending}
      onPendingChange={setPending}
      onAnalysis={(analysis, revision) =>
        perform((current) => applyAnalysis(current, analysis, revision))
      }
    />
  );
  return (
    <>
      <AppHeader />
      <header className="sticky top-0 z-20 border-b bg-white">
        <div className="mx-auto max-w-6xl px-5 py-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            <ArrowLeft size={14} />
            {tx("Back")}
          </Link>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="min-w-0 break-words text-xl font-semibold">{meetingTitle(m)}</h1>
            {!ended && (
              <p className="text-sm font-medium text-muted-foreground lg:hidden">{tx(status)}</p>
            )}
            {!ended && (
              <Button
                disabled={pending || editing}
                onClick={() => {
                  if (perform(prepareMeeting)) {
                    setPreparedRevision(m.stateRevision);
                    statusRef.current?.scrollIntoView({ block: "start" });
                  }
                }}
              >
                {tx("Prepare to End Meeting")}
              </Button>
            )}
            {m.isDemo && ended && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  resetDemo();
                  setPreparedRevision(null);
                  setError(null);
                  setNotice(null);
                }}
              >
                {tx("Reset Demo")}
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-5 px-5 py-6">
        {warning && <Notice error>{warning}</Notice>}
        {error && <Notice error>{error}</Notice>}
        {notice && <Notice>{notice}</Notice>}
        {ended ? (
          <>
            <MeetingSummaryView meeting={m} />
            <details className="border-t pt-4">
              <summary className="text-sm text-muted-foreground">{tx("Meeting record")}</summary>
              <div className="mt-5 space-y-6">
                {requirementsView}
                {transcriptView}
                <Coverage meeting={m} />
              </div>
            </details>
          </>
        ) : (
          <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-6">
              {requirementsView}
              {transcriptView}
            </div>
            <section
              ref={statusRef}
              id="meeting-status"
              aria-labelledby="status-heading"
              className="min-w-0 scroll-mt-36 rounded-xl bg-white p-5 lg:sticky lg:top-32"
            >
              <h2 id="status-heading" className="text-sm font-medium text-muted-foreground">
                {tx("Meeting Status")}
              </h2>
              <div className="my-3" role="status" aria-live="polite">
                <p
                  className={`text-xl font-semibold ${m.analysis && !pending ? (check.readiness === "READY" ? "text-primary" : "text-destructive") : ""}`}
                >
                  {tx(status)}
                  {m.analysis && !pending && check.blockingGaps.length > 0 && (
                    <span className="ml-2 text-sm font-normal">
                      {tx("{count} issues", { count: check.blockingGaps.length })}
                    </span>
                  )}
                </p>
                {m.analysis && !pending && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {tx("{done} of {total} requirements complete", {
                      done: covered,
                      total: required.length,
                    })}{" "}
                    · {tx(m.analysis.provider === "demo" ? "Demo Analysis" : "AI Analysis")}
                  </p>
                )}
              </div>
              {!m.analysis && !pending && (
                <p className="text-sm text-muted-foreground">
                  {tx("Add a transcript, then analyze the meeting.")}
                </p>
              )}
              {m.analysis && !pending && (
                <>
                  <GapCheck
                    meeting={m}
                    check={check}
                    prepared={preparedRevision === m.stateRevision && !!m.completionCheck}
                    onContinue={() => {
                      document.getElementById("transcript")?.focus();
                    }}
                    onActions={showActions}
                    onEnd={(reason) => {
                      if (perform((current) => endMeeting(current, reason))) window.scrollTo(0, 0);
                    }}
                    onConvert={(gap, action) => {
                      if (
                        perform(
                          (current) => convertGap(current, gap, action),
                          "Action created. Check readiness again.",
                        )
                      )
                        showActions();
                    }}
                  />
                  <details className="mt-5 border-t pt-3">
                    <summary className="text-sm text-muted-foreground">
                      {tx("Analysis details")}
                    </summary>
                    <div className="mt-4">
                      <Coverage meeting={m} />
                    </div>
                  </details>
                </>
              )}
              <details ref={actionsRef} className="mt-4 scroll-mt-36 border-t pt-3">
                <summary className="text-sm text-muted-foreground">
                  {tx("Action Items")} ({m.actionItems.length})
                </summary>
                <div className="mt-4">
                  <ActionItems
                    meeting={m}
                    disabled={pending}
                    onChange={(items) => perform((current) => updateActionItems(current, items))}
                  />
                </div>
              </details>
            </section>
          </div>
        )}
        {m.isDemo && !ended && (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              resetDemo();
              setPreparedRevision(null);
              setError(null);
              setNotice(null);
            }}
          >
            {tx("Reset Demo")}
          </Button>
        )}
      </main>
      {editing && (
        <EditRequirements
          meeting={m}
          onClose={() => setEditing(false)}
          save={(title, requirements, builtinTitle) =>
            perform(
              (current) => ({ ...updateRequirements(current, requirements), title, builtinTitle }),
              "Re-analyze after changing meeting requirements",
            )
          }
        />
      )}
    </>
  );
}
