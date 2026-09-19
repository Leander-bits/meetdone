"use client";
import { Meeting } from "@/lib/models";
import { useMeetingPresentation } from "./meeting-presentation";
import { useI18n } from "./language-provider";
import { Button } from "./ui/button";
import { meetingStatus } from "./shared";

export function MeetingSummaryView({ meeting: m }: { meeting: Meeting }) {
  const { t: tx, label } = useI18n();
  const { gapTitle, gapDescription, actionTitle } = useMeetingPresentation(m);
  const s = m.summary;
  if (!s) return null;
  const content = (text: string) => (m.analysis?.provider === "demo" ? tx(text) : text);
  const openGaps = [
    ...(m.completionCheck?.blockingGaps ?? []),
    ...(m.completionCheck?.followUpGaps ?? []),
  ];
  const exceptions = [...new Set(s.acceptedExceptions.map((e) => e.reason))];
  const list = (heading: string, items: string[]) => (
    <section className="border-t py-4">
      <h3 className="mb-2 text-sm font-semibold">{tx(heading)}</h3>
      {items.length ? (
        <ul className="list-disc space-y-1.5 pl-4 text-sm leading-6">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{tx("None recorded")}</p>
      )}
    </section>
  );
  return (
    <div className="max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title">{tx("Meeting summary")}</h2>
        <Button
          variant="ghost"
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
          {tx("Export summary")}
        </Button>
      </div>
      <dl className="mb-5 flex flex-wrap items-center gap-3 text-sm">
        <dt className="text-muted-foreground">{tx("Final Status")}</dt>
        <dd
          className={`font-semibold ${s.lifecycle === "ended_with_exceptions" ? "text-amber-800" : "text-primary"}`}
        >
          {tx(meetingStatus(m))}
        </dd>
        <dd className="text-xs text-muted-foreground">
          {tx(m.analysis?.provider === "demo" ? "Demo Analysis" : "AI Analysis")}
        </dd>
      </dl>
      {list("Meeting Goal", m.requirements.items.filter((r) => r.kind === "goal").map(label))}
      {list("Decisions", s.decisions.map(content))}
      <section className="border-t py-4">
        <h3 className="mb-3 text-sm font-semibold">{tx("Action Items")}</h3>
        {s.actionItems.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  {["Action", "Owner", "Deadline", "Status"].map((key) => (
                    <th key={key} className="whitespace-nowrap pb-2 pr-4 font-medium">
                      {tx(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.actionItems.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="min-w-40 py-3 pr-4">{actionTitle(a)}</td>
                    <td className="py-3 pr-4">{a.owner || tx("Unassigned")}</td>
                    <td className="whitespace-nowrap py-3 pr-4">{a.deadline || tx("Missing")}</td>
                    <td className="whitespace-nowrap py-3">
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
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{tx("None recorded")}</p>
        )}
      </section>
      {list("Open Issues", [
        ...new Set([
          ...s.unresolvedIssues.map(content),
          ...openGaps.map((g) => `${gapTitle(g)}: ${gapDescription(g)}`),
        ]),
      ])}
      {list("Exceptions", exceptions)}
    </div>
  );
}
