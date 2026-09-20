import { Meeting } from "./models";
import { Locale, translate } from "./i18n";
import { meetingPresentation } from "./meeting-presentation";
import { scheduleText } from "./meeting-structure";

export function summaryMarkdown(m: Meeting, locale: Locale) {
  if (!m.summary) throw new Error("No meeting summary.");
  const s = m.summary;
  const tx = (key: string) => translate(locale, key);
  const { gapTitle, gapDescription, actionTitle } = meetingPresentation(m, locale);
  const gaps = [
    ...(m.completionCheck?.blockingGaps ?? []),
    ...(m.completionCheck?.followUpGaps ?? []),
  ];
  const safe = (text: string) => text.replaceAll("|", "\\|").replaceAll("\n", " ");
  const list = (heading: string, values: string[]) =>
    `## ${tx(heading)}\n\n${values.length ? values.map((v) => `- ${safe(v)}`).join("\n") : tx("None recorded")}\n`;
  const name = m.builtinTitle ? tx(m.title) : m.title;
  const originalGoals = m.requirements.items
    .filter((r) => r.kind === "goal")
    .map((r) => (r.builtinKey === r.label ? tx(r.label) : r.label));
  return (
    `# MeetDone · ${name}\n\n${scheduleText(m) ?? tx("Schedule not recorded")}\n\n` +
    list("Original Meeting Goals", originalGoals) +
    "\n" +
    list("Achieved Conclusions", s.conclusions) +
    "\n" +
    list("Decisions Made", s.decisions) +
    "\n" +
    list("Unresolved Issues", s.unresolvedIssues) +
    `\n## ${tx("Action Items")}\n\n| ${tx("Action")} | ${tx("Owner")} | ${tx("Deadline")} |\n| --- | --- | --- |\n` +
    s.actionItems
      .map((a) => {
        const description = actionTitle(a);
        return `| ${safe(description)} | ${safe(a.owner ?? tx("Unassigned"))} | ${safe(a.deadline ?? tx("Missing"))} |`;
      })
      .join("\n") +
    "\n\n" +
    list(
      "Remaining Risks",
      gaps.length ? gaps.map((g) => `${gapTitle(g)}: ${gapDescription(g)}`) : s.remainingRisks,
    ) +
    "\n" +
    list(
      "Exceptions",
      s.acceptedExceptions.map((e, index) => {
        const resolution = m.gapResolutions.filter((r) => r.type === "exception")[index];
        const gap =
          gaps.find((g) => g.id === resolution?.gapId) ?? gaps.find((g) => g.title === e.gap);
        return `${gap ? gapTitle(gap) : e.gap}: ${e.reason}`;
      }),
    ) +
    `\n## ${tx("Final Status")}\n\n${tx(s.lifecycle === "ended_with_exceptions" ? "Ended with Exceptions" : "Ended")}\n`
  );
}
export function summaryFilename(m: Meeting, locale: Locale) {
  const name = (m.builtinTitle ? translate(locale, m.title) : m.title)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .slice(0, 100);
  return `MeetDone_${name}_${m.date || m.summary?.endedAt.slice(0, 10) || new Date().toISOString().slice(0, 10)}.md`;
}
export function downloadSummary(m: Meeting, locale: Locale) {
  const url = URL.createObjectURL(
    new Blob([summaryMarkdown(m, locale)], { type: "text/markdown;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = summaryFilename(m, locale);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
