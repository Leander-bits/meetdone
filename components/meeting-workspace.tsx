"use client";
import { useI18n } from "@/components/language-provider";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileText,
  Flag,
  LayoutList,
  ListChecks,
  MessageSquareText,
  RotateCcw,
  Settings2,
  Sparkles,
} from "lucide-react";
import { Meeting, MeetingRequirements } from "@/lib/models";
import { TranscriptPanel } from "./transcript-panel";
import { templates } from "@/lib/templates";
import {
  applyAnalysis,
  convertGap,
  endMeeting,
  evaluateMeeting,
  prepareMeeting,
  updateActionItems,
  updateRequirements,
} from "@/lib/meeting-state";
import { cn } from "@/lib/utils";
import { useWorkspace } from "./workspace-store";
import {
  AboutDemo,
  AppHeader,
  LifecycleBadge,
  LoadingWorkspace,
  Notice,
  StatusBadge,
} from "./shared";
import { Coverage, coverageFor } from "./coverage";
import { ActionItems } from "./action-items";
import { GapCheck } from "./gap-check";
import { MeetingSummaryView } from "./meeting-summary";
import { RequirementsEditor } from "./requirements-editor";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const sections = [
  { id: "requirements", label: "Requirements", icon: Settings2 },
  { id: "transcript", label: "Transcript", icon: MessageSquareText },
  { id: "coverage", label: "Coverage", icon: LayoutList },
  { id: "decisions", label: "Decisions", icon: Flag },
  { id: "actions", label: "Action Items", icon: ClipboardList },
  { id: "gaps", label: "Gap Check", icon: ListChecks },
  { id: "summary", label: "Summary", icon: FileText },
] as const;
type Section = (typeof sections)[number]["id"];

function RequirementsPanel({
  meeting: m,
  save,
  onDirtyChange,
}: {
  meeting: Meeting;
  save: (title: string, r: MeetingRequirements, builtinTitle: boolean) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { t: tx } = useI18n();

  const [title, setTitle] = useState(m.title);
  const [builtinTitle, setBuiltinTitle] = useState(!!m.builtinTitle);
  const [draft, setDraft] = useState(structuredClone(m.requirements));
  const dirty =
    title !== m.title ||
    builtinTitle !== !!m.builtinTitle ||
    JSON.stringify(draft) !== JSON.stringify(m.requirements);
  const ended = m.lifecycle !== "active";
  return (
    <div className="space-y-5">
      <div>
        <h2 className="section-title">{tx("Define what done means")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {tx("Set the outcomes this meeting must deliver before it ends.")}
        </p>
      </div>
      <Notice>
        {tx(
          "Required items block completion. Recommended items become follow-ups. Record-only items are kept for context. Saving edits clears analysis and the previous check; reload analysis to evaluate the new requirements.",
        )}
      </Notice>
      <div className="surface space-y-6 p-5">
        <label className="block">
          <span className="field-label">{tx("Meeting title")}</span>
          <Input
            disabled={ended}
            value={builtinTitle ? tx(title) : title}
            onChange={(e) => {
              setTitle(e.target.value);
              setBuiltinTitle(false);
              onDirtyChange(
                e.target.value !== m.title ||
                  !!m.builtinTitle ||
                  JSON.stringify(draft) !== JSON.stringify(m.requirements),
              );
            }}
            maxLength={140}
          />
        </label>
        <RequirementsEditor
          value={draft}
          onChange={(next) => {
            setDraft(next);
            onDirtyChange(
              title !== m.title ||
                builtinTitle !== !!m.builtinTitle ||
                JSON.stringify(next) !== JSON.stringify(m.requirements),
            );
          }}
          disabled={ended}
        />
        {!ended && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              {dirty ? tx("Unsaved requirement changes") : tx("Requirements saved")}
            </p>
            {dirty && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTitle(m.title);
                  setBuiltinTitle(!!m.builtinTitle);
                  setDraft(structuredClone(m.requirements));
                  onDirtyChange(false);
                }}
              >
                {tx("Discard edits")}
              </Button>
            )}
            <Button
              disabled={
                !dirty ||
                !title.trim() ||
                draft.items.some((r) => !r.label.trim()) ||
                !draft.items.some((r) => r.kind === "goal")
              }
              onClick={() => save(title.trim(), draft, builtinTitle)}
            >
              {tx("Save requirements")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function MeetingWorkspace({ id }: { id: string }) {
  const { t: tx, label, title: meetingTitle } = useI18n();

  const { loaded, meetings, warning, updateMeeting, resetDemo } = useWorkspace();
  const [section, setSection] = useState<Section>("coverage");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [requirementsDirty, setRequirementsDirty] = useState(false);
  if (!loaded) return <LoadingWorkspace />;
  const m = meetings.find((m) => m.id === id);
  if (!m)
    return (
      <>
        <AppHeader />
        <main className="mx-auto max-w-xl space-y-4 p-10">
          <h1 className="text-2xl font-semibold">{tx("Meeting not found in this browser")}</h1>
          <p className="text-sm text-muted-foreground">
            {tx(
              "Meetings are saved locally. Open the original browser or start with the preloaded demo.",
            )}
          </p>
          <Button asChild>
            <Link href="/">{tx("Back to meetings")}</Link>
          </Button>
        </main>
      </>
    );
  const ended = m.lifecycle !== "active";
  const preview = evaluateMeeting(m);
  const required = m.requirements.items.filter((r) => r.level === "required");
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
  const prepare = () => {
    if (requirementsDirty) return;
    if (perform(prepareMeeting)) setSection("gaps");
  };
  const end = (reason?: string) => {
    if (perform((current) => endMeeting(current, reason))) setSection("summary");
  };
  const readiness = requirementsDirty
    ? "Unsaved edits"
    : m.completionCheck
      ? m.completionCheck.readiness === "READY"
        ? "Ready to end"
        : "Blocked"
      : "Not checked";
  const statusTone = requirementsDirty
    ? "neutral"
    : m.completionCheck
      ? m.completionCheck.readiness === "READY"
        ? "good"
        : "bad"
      : "neutral";
  return (
    <>
      <AppHeader />
      <div className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur-sm">
        <div className="mx-auto max-w-[1440px] px-5 py-4 sm:px-9">
          <Link
            href="/"
            className="mb-3 flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
          >
            <ArrowLeft size={12} />
            {tx("All meetings")}
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="eyebrow">
                  {tx(templates.find((t) => t.id === m.templateId)!.name)}
                </span>
                <LifecycleBadge lifecycle={m.lifecycle} />
              </div>
              <h1 className="break-words text-xl font-semibold tracking-tight sm:text-2xl">
                {meetingTitle(m)}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-left sm:text-right">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {tx("Meeting Readiness")}
                </p>
                <StatusBadge tone={statusTone}>{readiness}</StatusBadge>
              </div>
              <Button
                disabled={requirementsDirty}
                className="shadow-sm"
                onClick={ended ? () => setSection("summary") : prepare}
              >
                {ended ? <FileText size={16} /> : <ListChecks size={16} />}
                {ended ? tx("View Summary") : tx("Prepare to End Meeting")}
                {!ended && <ArrowRight className="hidden sm:block" size={15} />}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-6 px-5 py-6 sm:px-9 lg:grid-cols-[210px_minmax(0,1fr)_250px]">
        <aside>
          <nav
            aria-label="Meeting sections"
            className="flex gap-1 overflow-x-auto pb-2 lg:sticky lg:top-40 lg:flex-col"
          >
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  if (requirementsDirty && s.id !== "requirements") {
                    setNotice(
                      "Save or discard your requirement edits before changing sections or checking readiness.",
                    );
                    return;
                  }
                  setSection(s.id);
                  setNotice(null);
                }}
                aria-current={section === s.id ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm",
                  section === s.id
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <s.icon size={16} />
                {tx(s.label)}
                {s.id === "gaps" && m.analysis && preview.blockingGaps.length > 0 && (
                  <span className="ml-auto rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-800">
                    {preview.blockingGaps.length}
                  </span>
                )}
              </button>
            ))}
            <div className="mt-8 hidden border-t pt-5 lg:block">
              <p className="px-3 text-xs leading-5 text-muted-foreground">
                {tx("A meeting is done when its outcomes are clear.")}
              </p>
              {m.isDemo && (
                <Button
                  className="mt-3"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    resetDemo();
                    setRequirementsDirty(false);
                    setSection("coverage");
                    setError(null);
                    setNotice("Demo reset to Scenario A. Your other meetings are preserved.");
                  }}
                >
                  <RotateCcw size={13} />
                  {tx("Reset Demo")}
                </Button>
              )}
            </div>
          </nav>
        </aside>
        <main className="min-w-0 space-y-4">
          {warning && <Notice error>{warning}</Notice>}
          {error && <Notice error>{error}</Notice>}
          {notice && <Notice>{notice}</Notice>}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/15 bg-accent/60 px-4 py-2.5">
            <span className="flex items-center gap-2 text-xs font-medium text-primary">
              <Sparkles size={13} />
              {tx(
                m.analysis
                  ? m.analysis.provider === "demo"
                    ? "Demo Analysis Mode"
                    : "AI Analysis Mode"
                  : "Not analyzed",
              )}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {m.analysis
                ? tx(
                    m.analysis.provider === "demo"
                      ? "Fixed transcript fixture · Evidence included"
                      : "AI extraction · Readiness checked by rules",
                  )
                : tx("Custom text is saved without analysis")}
            </span>
          </div>
          {ended && section !== "summary" && (
            <Notice>
              {tx(
                "This meeting has ended. Its requirements and outcome are preserved. View the summary or reset the demo to try again.",
              )}
            </Notice>
          )}
          {section === "requirements" && (
            <RequirementsPanel
              key={m.requirements.revision}
              meeting={m}
              onDirtyChange={setRequirementsDirty}
              save={(title, r, builtinTitle) => {
                if (
                  perform(
                    (current) => ({ ...updateRequirements(current, r), title, builtinTitle }),
                    "Requirements saved. Analyze the demo again; edited requirements without matching evidence will appear as gaps.",
                  )
                )
                  setRequirementsDirty(false);
              }}
            />
          )}
          {section === "transcript" && (
            <TranscriptPanel
              meeting={m}
              update={perform}
              onAnalysis={(analysis, revision) =>
                perform((current) => applyAnalysis(current, analysis, revision))
              }
            />
          )}
          {section === "coverage" && <Coverage meeting={m} />}
          {section === "decisions" && <Coverage meeting={m} only="decision" />}
          {section === "actions" && (
            <ActionItems
              meeting={m}
              onChange={(items) => perform((current) => updateActionItems(current, items))}
            />
          )}
          {section === "gaps" && (
            <GapCheck
              meeting={m}
              onPrepare={prepare}
              onContinue={() => setSection("transcript")}
              onActions={() => setSection("actions")}
              onEnd={end}
              onConvert={(gap, action) => {
                if (
                  perform(
                    (current) => convertGap(current, gap, action),
                    "Action created. Run Prepare to End Meeting again to validate the commitment.",
                  )
                )
                  setSection("actions");
              }}
            />
          )}
          {section === "summary" && <MeetingSummaryView meeting={m} />}
          <AboutDemo />
        </main>
        <aside className="space-y-4 lg:sticky lg:top-40 lg:self-start">
          <section className="surface overflow-hidden">
            <div className="border-b px-5 py-4">
              <h2 className="text-sm font-semibold">{tx("Meeting Readiness")}</h2>
            </div>
            <div className="p-5">
              <StatusBadge tone={statusTone}>{readiness}</StatusBadge>
              <div className="mb-2 mt-5 flex items-baseline justify-between">
                <span className="text-3xl font-semibold tracking-tight">
                  {covered}
                  <span className="text-lg font-normal text-muted-foreground">
                    {" "}
                    / {required.length}
                  </span>
                </span>
                <CheckCircle2 size={17} className="text-primary" />
              </div>
              <p className="text-xs text-muted-foreground">{tx("Required outcomes covered")}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${required.length ? (covered / required.length) * 100 : 0}%` }}
                />
              </div>
              <div className="mt-5 space-y-3 border-t pt-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{tx("Blocking gaps")}</span>
                  <span
                    className={
                      m.analysis && preview.blockingGaps.length
                        ? "font-semibold text-destructive"
                        : "font-medium"
                    }
                  >
                    {m.analysis ? preview.blockingGaps.length : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{tx("Follow-up gaps")}</span>
                  <span className="font-medium">
                    {m.analysis ? preview.followUpGaps.length : "—"}
                  </span>
                </div>
              </div>
              <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
                {m.completionCheck
                  ? tx("Validated against the current meeting state.")
                  : tx("Preview only. Prepare to end to validate the current state.")}
              </p>
            </div>
          </section>
          <section className="px-1">
            <p className="eyebrow mb-2">{tx("The meeting goal")}</p>
            <p className="text-xs leading-6 text-muted-foreground">
              {m.requirements.items
                .filter((r) => r.kind === "goal")
                .map(label)
                .join(" · ")}
            </p>
          </section>
          {m.isDemo && (
            <div className="rounded-lg border border-dashed p-4">
              <p className="text-xs font-semibold">{tx("Try the complete journey")}</p>
              <ol className="mt-2 list-decimal space-y-2 pl-4 text-xs leading-5 text-muted-foreground">
                <li>{tx("Prepare to end and inspect four blockers.")}</li>
                <li>{tx("Load Scenario B in Transcript, then analyze.")}</li>
                <li>{tx("Check again and end with a summary.")}</li>
              </ol>
              <Button
                variant="ghost"
                className="mt-3 h-auto p-0 text-xs lg:hidden"
                onClick={() => {
                  resetDemo();
                  setSection("coverage");
                }}
              >
                {tx("Reset Demo")}
              </Button>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
