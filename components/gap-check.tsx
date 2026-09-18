"use client";
import { useMeetingPresentation } from "./meeting-presentation";
import { useI18n } from "@/components/language-provider";
import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Flag,
  ListChecks,
  MessageSquare,
  ShieldAlert,
} from "lucide-react";
import { ActionItem, Gap, Meeting } from "@/lib/models";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { EvidenceList, Notice, StatusBadge } from "./shared";

export function GapCheck({
  meeting: m,
  onContinue,
  onPrepare,
  onEnd,
  onConvert,
  onActions,
}: {
  meeting: Meeting;
  onContinue: () => void;
  onPrepare: () => void;
  onEnd: (reason?: string) => void;
  onConvert: (gap: Gap, action: ActionItem) => void;
  onActions: () => void;
}) {
  const { t: tx } = useI18n();
  const { gapTitle, gapDescription } = useMeetingPresentation(m);

  const check = m.completionCheck;
  const [exception, setException] = useState(false);
  const [reason, setReason] = useState("");
  const [converting, setConverting] = useState<Gap | null>(null);
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState("");
  const [deadline, setDeadline] = useState("");
  const ended = m.lifecycle !== "active";
  if (!check)
    return (
      <div className="surface px-6 py-12 text-center">
        <ListChecks className="mx-auto mb-4 text-primary" size={32} />
        <h2 className="section-title">{tx("Check the finish line")}</h2>
        <p className="mx-auto mb-6 mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {tx(
            "Run the check against the current requirements, discussion, and action items. Any edits require a fresh check.",
          )}
        </p>
        <Button onClick={onPrepare}>
          {tx("Prepare to End Meeting")}
          <ArrowRight size={15} />
        </Button>
      </div>
    );
  const ready = check.readiness === "READY";
  const canEnd = !check.blockingGaps.some((g) => g.type === "analysis_missing");
  const group = (gaps: Gap[], blocking: boolean) => (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        {blocking ? (
          <ShieldAlert size={16} className="text-destructive" />
        ) : (
          <Flag size={16} className="text-amber-700" />
        )}
        {blocking ? tx("Blocking gaps") : tx("Follow-up gaps")}
        <span className="text-muted-foreground">{gaps.length}</span>
      </h3>
      {gaps.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-3 text-xs text-muted-foreground">
          {blocking
            ? tx("No blockers. All required outcomes are complete or explicitly deferred.")
            : tx("No follow-up gaps.")}
        </p>
      ) : (
        gaps.map((gap) => (
          <article className="surface p-5" key={gap.id}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="eyebrow">{tx(gap.type.replaceAll("_", " "))}</span>
              <StatusBadge tone={blocking ? "bad" : "warn"}>
                {blocking ? tx("Blocking") : tx("Follow-up")}
              </StatusBadge>
            </div>
            <h4 className="text-sm font-semibold">{gapTitle(gap)}</h4>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{gapDescription(gap)}</p>
            <p className="mt-3 flex gap-2 text-xs leading-5">
              <ArrowRight size={14} className="mt-0.5 shrink-0 text-primary" />
              {tx(gap.nextAction)}
            </p>
            <EvidenceList ids={gap.evidenceIds} evidence={m.analysis?.evidence ?? []} />
            {!ended && gap.type !== "analysis_missing" && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
                {(gap.type === "action_owner" || gap.type === "action_deadline") && (
                  <Button variant="outline" size="sm" onClick={onActions}>
                    {tx("Edit action item")}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setConverting(gap);
                    setDescription(
                      gap.type === "action_missing" ? gap.title : `Follow up: ${gapTitle(gap)}`,
                    );
                    setOwner("");
                    setDeadline("");
                  }}
                >
                  {tx("Convert to Action Item")}
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  {gap.type === "action_missing"
                    ? tx("Supply the required output")
                    : gap.allowsDeferral || !blocking
                      ? tx("Deferral allowed")
                      : tx("Follow-up will not clear this blocker")}
                </span>
              </div>
            )}
          </article>
        ))
      )}
    </section>
  );
  return (
    <div className="space-y-6">
      <div
        className={`rounded-xl border p-6 ${ready ? "border-emerald-200 bg-emerald-50/60" : "border-red-200 bg-red-50/40"}`}
      >
        <div className="flex gap-3">
          {ready ? (
            <CheckCircle2 size={25} className="mt-0.5 shrink-0 text-emerald-700" />
          ) : (
            <ShieldAlert size={25} className="mt-0.5 shrink-0 text-destructive" />
          )}
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              {ended
                ? m.lifecycle === "ended_with_exceptions"
                  ? tx("Ended with Exceptions")
                  : tx("Meeting ended")
                : ready
                  ? tx("Ready to end meeting")
                  : tx("Meeting cannot end yet")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {ready
                ? tx(
                    "All required outcomes are satisfied. You can end the meeting and capture its structured summary.",
                  )
                : `${tx("{count} blocking gaps need attention.", { count: check.blockingGaps.length })} ${ended ? tx("The host accepted these risks; readiness remains blocked.") : tx("Keep the discussion focused on what is missing.")}`}
            </p>
          </div>
        </div>
        {!ended && (
          <div className="mt-5 flex flex-wrap gap-2">
            {ready ? (
              <Button onClick={() => onEnd()}>
                {tx("End Meeting & Generate Summary")}
                <ArrowRight size={15} />
              </Button>
            ) : (
              <Button onClick={onContinue}>
                <MessageSquare size={15} />
                {tx("Continue Discussion")}
              </Button>
            )}
            {!ready && (
              <Button variant="outline" disabled={!canEnd} onClick={() => setException(true)}>
                {tx("End with Exception")}
              </Button>
            )}
          </div>
        )}
      </div>
      {group(check.blockingGaps, true)}
      {group(check.followUpGaps, false)}
      {check.deferredGapIds.length > 0 && (
        <Notice>
          {tx(
            "{count} gap(s) deferred to action items with an owner and deadline. These are tracked commitments, not completed discussion.",
            { count: check.deferredGapIds.length },
          )}
        </Notice>
      )}
      <p className="text-xs text-muted-foreground">
        {tx("Deterministic check")} · {tx("requirements v")}
        {check.requirementsRevision} · {tx("transcript v")}
        {check.transcriptRevision}
      </p>
      <Dialog open={exception} onOpenChange={setException}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tx("End with unresolved blockers?")}</DialogTitle>
            <DialogDescription>
              {tx(
                "Record why you are accepting all {count} blocking gaps below. The meeting will be marked Ended with Exceptions; readiness stays blocked.",
                { count: check.blockingGaps.length },
              )}
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-muted-foreground">
            {check.blockingGaps.map((g) => (
              <li key={g.id}>
                {gapTitle(g)} — {gapDescription(g)}
              </li>
            ))}
          </ul>
          <label>
            <span className="field-label">
              {tx("Exception reason")}
              <span className="text-destructive">*</span>
            </span>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={tx("Why is ending acceptable, and what risk are you accepting?")}
              rows={4}
            />
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setException(false)}>
              {tx("Keep meeting open")}
            </Button>
            <Button
              disabled={!reason.trim()}
              onClick={() => {
                onEnd(reason);
                setException(false);
              }}
            >
              {tx("End with Exception")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!converting} onOpenChange={(open) => !open && setConverting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tx("Turn this gap into a commitment")}</DialogTitle>
            <DialogDescription>
              {converting?.type === "action_missing"
                ? tx("Create the missing required action with clear accountability.")
                : converting?.allowsDeferral || converting?.severity === "FOLLOW_UP"
                  ? tx(
                      "An owned, dated action can defer this gap. Run the check again after creating it.",
                    )
                  : tx(
                      "This requirement does not allow deferral. The follow-up will be tracked, but the blocker will remain.",
                    )}
            </DialogDescription>
          </DialogHeader>
          <label>
            <span className="field-label">{tx("Description")}</span>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label>
            <span className="field-label">{tx("Owner")}</span>
            <Input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder={tx("Who is accountable?")}
            />
          </label>
          <label>
            <span className="field-label">{tx("Deadline")}</span>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConverting(null)}>
              {tx("Cancel")}
            </Button>
            <Button
              disabled={!description.trim() || !owner.trim() || !deadline}
              onClick={() => {
                if (converting)
                  onConvert(converting, {
                    id: crypto.randomUUID(),
                    description: description.trim(),
                    owner: owner.trim(),
                    deadline,
                    source: "host",
                    status: "open",
                    evidenceIds: [],
                  });
                setConverting(null);
              }}
            >
              {tx("Create action item")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
