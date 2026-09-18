"use client";
import { useMeetingPresentation } from "./meeting-presentation";
import { useI18n } from "@/components/language-provider";
import { Download, FileCheck2 } from "lucide-react";
import { Meeting } from "@/lib/models";
import { Button } from "./ui/button";
import { LifecycleBadge, Notice, StatusBadge } from "./shared";

export function MeetingSummaryView({ meeting: m }: { meeting: Meeting }) {
  const { t: tx, locale, label, title: meetingTitle } = useI18n();
  const { gapTitle, gapDescription, actionTitle } = useMeetingPresentation(m);

  const s = m.summary;
  if (!s)
    return (
      <div className="surface px-6 py-12 text-center">
        <FileCheck2 size={32} className="mx-auto mb-4 text-primary" />
        <h2 className="section-title">{tx("The outcome, captured")}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {tx(
            "End the meeting to generate a structured summary of supported conclusions, decisions, commitments, and any accepted exceptions.",
          )}
        </p>
      </div>
    );
  const list = (title: string, items: string[], empty: string) => (
    <section className="border-t pt-5">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {items.length ? (
        <ul className="list-disc space-y-2 pl-4 text-sm leading-6 text-muted-foreground">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="section-title">{tx("Meeting summary")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {tx("A preserved record of the meeting’s outcome.")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([JSON.stringify(s, null, 2)], { type: "application/json" }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = `meetdone-${m.id}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download size={14} />
          {tx("Export JSON")}
        </Button>
      </div>
      <div className="surface space-y-5 p-6">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <LifecycleBadge lifecycle={s.lifecycle} />
            <StatusBadge tone={s.readiness === "READY" ? "good" : "bad"}>
              {tx("Readiness")}: {s.readiness === "READY" ? tx("Ready") : tx("Blocked")}
            </StatusBadge>
          </div>
          <h3 className="text-xl font-semibold">{meetingTitle(m)}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {tx("Ended")}
            {new Date(s.endedAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-GB")} ·{" "}
            {tx(m.analysis?.provider === "demo" ? "Demo Analysis Mode" : "AI Analysis Mode")}
          </p>
        </div>
        <section className="rounded-lg bg-muted/70 p-4">
          <p className="eyebrow mb-2">{tx("Original meeting goal")}</p>
          <p className="text-sm leading-6">
            {m.requirements.items
              .filter((r) => r.kind === "goal")
              .map(label)
              .join("; ")}
          </p>
        </section>
        {list(
          tx("Goals achieved"),
          s.goalsAchieved.map((goal) => {
            const r = m.requirements.items.find((r) => r.kind === "goal" && r.label === goal);
            return r ? label(r) : goal;
          }),
          tx("No completed goals supported by the analysis."),
        )}
        {list(tx("Conclusions"), s.conclusions, tx("No supported conclusions recorded."))}
        {list(tx("Decisions"), s.decisions, tx("No final decisions recorded."))}
        {list(
          tx("Unresolved issues"),
          s.unresolvedIssues,
          tx(
            "No additional unresolved issues extracted. Outstanding requirement gaps appear under remaining risks.",
          ),
        )}
        <section className="border-t pt-5">
          <h3 className="mb-3 text-sm font-semibold">{tx("Action items")}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">{tx("Action")}</th>
                  <th className="pb-2 pr-4 font-medium">{tx("Owner")}</th>
                  <th className="pb-2 pr-4 font-medium">{tx("Deadline")}</th>
                  <th className="pb-2 font-medium">{tx("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {s.actionItems.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="min-w-48 py-3 pr-4">
                      {actionTitle(a)}
                      {a.gapId && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {tx("Linked gap follow-up")}
                        </p>
                      )}
                    </td>
                    <td className="min-w-28 py-3 pr-4">
                      {a.owner || <span className="text-destructive">{tx("Unassigned")}</span>}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4">
                      {a.deadline || <span className="text-destructive">{tx("Missing")}</span>}
                    </td>
                    <td className="py-3">
                      {tx(
                        a.status === "in_progress"
                          ? "In progress"
                          : a.status === "done"
                            ? "Done"
                            : a.status === "open"
                              ? "Open"
                              : "Unknown",
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!s.actionItems.length && (
              <p className="py-3 text-sm text-muted-foreground">
                {tx("No action items captured.")}
              </p>
            )}
          </div>
        </section>
        {list(
          tx("Remaining risks"),
          [
            ...(m.completionCheck?.blockingGaps ?? []),
            ...(m.completionCheck?.followUpGaps ?? []),
          ].map((g) => `${gapTitle(g)}: ${gapDescription(g)}`),
          tx("No remaining completion gaps."),
        )}
        <section className="border-t pt-5">
          <h3 className="mb-3 text-sm font-semibold">{tx("Accepted exceptions")}</h3>
          {s.acceptedExceptions.length ? (
            <div className="space-y-3">
              {s.acceptedExceptions.map((e, i) => (
                <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
                  <p className="font-medium">
                    {(() => {
                      const r = m.requirements.items.find((r) => r.label === e.gap);
                      return r ? label(r) : e.gap;
                    })()}
                  </p>
                  <p className="mt-1 leading-6 text-amber-950/80">{e.reason}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {tx("None. The meeting ended without blocking gaps.")}
            </p>
          )}
        </section>
      </div>
      <Notice>
        {tx(
          "Conclusions and decisions come from verified analysis. Host-edited actions and exception reasons are included as explicit host input.",
        )}
      </Notice>
    </div>
  );
}
