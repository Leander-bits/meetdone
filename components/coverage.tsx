"use client";
import { useI18n } from "@/components/language-provider";
import { CheckCircle2, Circle, CircleDashed } from "lucide-react";
import { Meeting, Requirement, kindLabels, requirementKey } from "@/lib/models";
import { validDeadline } from "@/lib/rule-engine";
import { EvidenceList, Notice, StatusBadge } from "./shared";

export function coverageFor(
  m: Meeting,
  r: Requirement,
): { label: string; complete: boolean; evidenceIds: string[]; detail?: string } {
  if (!m.analysis) return { label: "Not analyzed", complete: false, evidenceIds: [] };
  const match = (f: { requirementId: string; requirementKey: string }) =>
    f.requirementId === r.id && f.requirementKey === requirementKey(r, m.requirements.items);
  if (r.kind === "action") {
    const items = m.actionItems.filter((a) => a.requirementId === r.id);
    return {
      label: !items.length
        ? "Missing"
        : items.every(
              (a) => a.description.trim() && (a.owner ?? "").trim() && validDeadline(a.deadline),
            )
          ? "Complete"
          : "Partial",
      complete:
        !!items.length &&
        items.every(
          (a) => !!a.description.trim() && !!(a.owner ?? "").trim() && validDeadline(a.deadline),
        ),
      evidenceIds: items.flatMap((a) => a.evidenceIds),
    };
  }
  if (r.kind === "decision") {
    const f = m.analysis.decisions.find(match);
    return {
      label:
        f?.status === "decided"
          ? "Decided"
          : f?.status === "discussed"
            ? "Discussed, not decided"
            : "Missing",
      complete: f?.status === "decided",
      evidenceIds: f?.evidenceIds ?? [],
      detail: f?.detail,
    };
  }
  if (r.kind === "speaker") {
    const f = m.analysis.speakers.find(match);
    return {
      label:
        f?.status === "opinion"
          ? "Complete"
          : f?.status === "mentioned"
            ? "Mentioned only"
            : "Missing",
      complete: f?.status === "opinion",
      evidenceIds: f?.evidenceIds ?? [],
      detail: f?.detail,
    };
  }
  const list =
    r.kind === "goal"
      ? m.analysis.goals
      : r.kind === "conclusion"
        ? m.analysis.conclusions
        : m.analysis.topics;
  const f = list.find(match);
  return {
    label: f?.status === "complete" ? "Complete" : f?.status === "partial" ? "Partial" : "Missing",
    complete: f?.status === "complete",
    evidenceIds: f?.evidenceIds ?? [],
    detail: f?.detail,
  };
}
export function Coverage({ meeting: m, only }: { meeting: Meeting; only?: "decision" }) {
  const { t: tx, label } = useI18n();

  const kinds: Requirement["kind"][] = only
    ? [only]
    : ["goal", "conclusion", "topic", "speaker", "decision", "action"];
  return (
    <div className="space-y-5">
      <div>
        <h2 className="section-title">{only ? tx("Decisions") : tx("Coverage overview")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {only
            ? tx("A discussion is not a decision. Look for an explicit outcome.")
            : tx("What the discussion supports, measured against your requirements.")}
        </p>
      </div>
      {!m.analysis && (
        <Notice>{tx("Analyze the transcript to see coverage, or load a demo scenario.")}</Notice>
      )}
      {kinds.map((kind) => {
        const items = m.requirements.items.filter((r) => r.kind === kind);
        const completeCount = items.filter((r) => coverageFor(m, r).complete).length;
        if (!items.length) return null;
        return (
          <section key={kind} className="surface overflow-hidden">
            <div className="flex items-center justify-between border-b bg-muted/40 px-5 py-3">
              <h3 className="text-sm font-semibold">{tx(kindLabels[kind])}</h3>
              <span className="text-xs text-muted-foreground">
                {completeCount} / {items.length} {tx("complete")}
              </span>
            </div>
            <div className="divide-y">
              {items.map((r) => {
                const status = coverageFor(m, r);
                const Icon = status.complete
                  ? CheckCircle2
                  : status.label === "Partial"
                    ? CircleDashed
                    : Circle;
                const deferred = m.gapResolutions.some(
                  (res) =>
                    res.type === "action" &&
                    m.completionCheck?.deferredGapIds.includes(res.gapId) &&
                    res.gapId.includes(`:${r.id}`),
                );
                return (
                  <div key={r.id} className="flex gap-3 px-5 py-4">
                    <Icon
                      size={17}
                      className={`mt-0.5 shrink-0 ${status.complete ? "text-emerald-600" : "text-muted-foreground/60"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{label(r)}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {r.level === "record_only"
                              ? tx("Record only")
                              : r.level === "required"
                                ? tx("Required")
                                : tx("Recommended")}
                            {r.topicId &&
                              ` · ${label(m.requirements.items.find((t) => t.id === r.topicId) ?? r)}`}
                            {deferred && ` · ${tx("Deferred to action")}`}
                          </p>
                        </div>
                        <StatusBadge
                          tone={
                            status.complete
                              ? "good"
                              : !m.analysis || r.level === "record_only"
                                ? "neutral"
                                : r.level === "required"
                                  ? "bad"
                                  : "warn"
                          }
                        >
                          {status.label}
                        </StatusBadge>
                      </div>
                      {only && status.detail && (
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                          {status.detail}
                        </p>
                      )}
                      <EvidenceList
                        ids={status.evidenceIds}
                        evidence={m.analysis?.evidence ?? []}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
