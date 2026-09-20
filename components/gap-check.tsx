"use client";
import { useState } from "react";
import { ActionItem, CompletionCheck, Gap, Meeting } from "@/lib/models";
import { useMeetingPresentation } from "./meeting-presentation";
import { useI18n } from "./language-provider";
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
import { EvidenceList } from "./shared";

export function GapCheck({
  meeting: m,
  check,
  prepared,
  onContinue,
  onEnd,
  onConvert,
}: {
  meeting: Meeting;
  check: CompletionCheck;
  prepared: boolean;
  onContinue: () => void;
  onEnd: (reason?: string) => void;
  onConvert: (gap: Gap, action: ActionItem) => void;
  onActions: () => void;
}) {
  const { t: tx } = useI18n();
  const { gapTitle, gapDescription } = useMeetingPresentation(m);
  const [exception, setException] = useState(false);
  const [reason, setReason] = useState("");
  const [converting, setConverting] = useState<Gap | null>(null);
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState("");
  const [deadline, setDeadline] = useState("");
  const ready = check.readiness === "READY";
  const group = (gaps: Gap[]) =>
    gaps.map((gap) => (
      <article key={gap.id} className="py-4 first:pt-0">
        <h4 className="text-sm font-medium">{gapTitle(gap)}</h4>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{gapDescription(gap)}</p>
        <EvidenceList ids={gap.evidenceIds} evidence={m.analysis?.evidence ?? []} />
      </article>
    ));
  return (
    <div className="space-y-4">
      {check.blockingGaps.length > 0 && <div className="divide-y">{group(check.blockingGaps)}</div>}
      {check.followUpGaps.length > 0 && (
        <details className="border-t pt-3">
          <summary className="text-sm text-muted-foreground">
            {tx("Follow-up gaps")} ({check.followUpGaps.length})
          </summary>
          <div className="mt-3 divide-y">{group(check.followUpGaps)}</div>
        </details>
      )}
      {prepared && (
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button variant="outline" onClick={onContinue}>
            {tx("Continue Discussion")}
          </Button>
          <Button
            variant="outline"
            disabled={!check.blockingGaps.length && !check.followUpGaps.length}
            onClick={() => {
              const gap = [...check.blockingGaps, ...check.followUpGaps][0];
              setConverting(gap);
              setDescription(`${tx("Follow up")}: ${gapTitle(gap)}`);
              setOwner("");
              setDeadline("");
            }}
          >
            {tx("Convert Gap to Action Item")}
          </Button>
          {ready ? (
            <Button onClick={() => onEnd()}>{tx("End Meeting")}</Button>
          ) : (
            <Button onClick={() => setException(true)}>{tx("End with Exception")}</Button>
          )}
        </div>
      )}
      <Dialog open={exception} onOpenChange={setException}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tx("End with unresolved blockers?")}</DialogTitle>
            <DialogDescription>
              {tx("Explain why you are ending with {count} unresolved issues.", {
                count: check.blockingGaps.length,
              })}
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
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tx("Convert Gap to Action Item")}</DialogTitle>
            <DialogDescription>
              {converting?.type === "action_missing"
                ? tx("Add an owner and deadline.")
                : converting?.allowsDeferral || converting?.severity === "FOLLOW_UP"
                  ? tx("This issue can be deferred to an action item.")
                  : tx("This requirement does not allow deferral. The blocker will remain.")}
            </DialogDescription>
          </DialogHeader>
          <label>
            <span className="field-label">{tx("Gap")}</span>
            <select
              className="native-select"
              value={converting?.id ?? ""}
              onChange={(e) => {
                const gap = [...check.blockingGaps, ...check.followUpGaps].find(
                  (g) => g.id === e.target.value,
                )!;
                setConverting(gap);
                setDescription(`${tx("Follow up")}: ${gapTitle(gap)}`);
              }}
            >
              {[...check.blockingGaps, ...check.followUpGaps].map((g) => (
                <option key={g.id} value={g.id}>
                  {gapTitle(g)}
                </option>
              ))}
            </select>
          </label>
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
