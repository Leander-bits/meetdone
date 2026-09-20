"use client";
import { Meeting, Requirement, kindLabels, actionValidation } from "@/lib/models";
import { orderedRequirements, ruleKinds } from "@/lib/requirement-display";
import { useI18n } from "./language-provider";

export function MeetingRequirementsView({ meeting: m }: { meeting: Meeting }) {
  const { t, label } = useI18n();
  const s = m.structure;
  const stages = s.type === "time" ? s.segments : s.stages;
  const recorded = !!(s.segments.length || s.stages.length || s.speakerOrder.length);
  const list = (items: Requirement[], numbered = true) => (
    <ol className={`space-y-1 ${numbered ? "list-decimal pl-5" : "list-none"}`}>
      {items.map((r) => (
        <li key={r.id}>{label(r)}</li>
      ))}
    </ol>
  );
  const speakers = m.requirements.items.filter(
    (r) =>
      r.kind === "speaker" &&
      r.level === "required" &&
      (s.type !== "matrix" || !s.stages.some((stage) => r.topicId === `structure-${stage.id}`)),
  );
  const rules = orderedRequirements(
    m.requirements.items.filter(
      (r) =>
        r.level !== "record_only" &&
        ruleKinds.some((kind) => kind === r.kind) &&
        (!recorded || !r.id.startsWith("structure-")),
    ),
  );
  return (
    <div className="space-y-5 text-sm leading-6">
      <section>
        <h3 className="mb-2 font-semibold">{t("Meeting Goals")}</h3>
        {list(m.goals, m.goals.length > 1)}
      </section>
      <section>
        <h3 className="mb-2 font-semibold">
          {t(
            !recorded
              ? "Structure not recorded"
              : s.type === "speaker"
                ? "Required Speakers"
                : s.type === "matrix"
                  ? "Required Speakers by Stage"
                  : s.type === "time"
                    ? "Segment Goals"
                    : "Stage Goals",
          )}
        </h3>
        {s.type === "speaker" ? (
          list([
            ...s.speakerOrder.flatMap((id) => speakers.filter((r) => r.id === `speaker-all-${id}`)),
            ...speakers.filter((r) => !s.speakerOrder.some((id) => r.id === `speaker-all-${id}`)),
          ])
        ) : (
          <ol className="list-decimal space-y-3 pl-5">
            {stages.map((stage) => (
              <li key={stage.id}>
                <span className="font-medium">
                  {stage.builtinKey === stage.name ? t(stage.name) : stage.name}
                </span>
                {"minutes" in stage && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {stage.minutes} {t("minutes")}
                  </span>
                )}
                <ol className="list-[lower-alpha] pl-5 text-muted-foreground">
                  {stage.goals
                    .filter((g) => g.text.trim())
                    .map((g) => (
                      <li key={g.id}>{g.builtinKey === g.text ? t(g.text) : g.text}</li>
                    ))}
                </ol>
                {s.type === "matrix" && "assignments" in stage && (
                  <ul className="list-disc pl-5">
                    {stage.assignments
                      .filter((a) => a.required)
                      .map((a) => {
                        const p = m.participants.find((p) => p.id === a.participantId);
                        return (
                          p && (
                            <li key={p.id}>
                              {p.name}（{p.roleLabel ?? t(p.role)}）
                            </li>
                          )
                        );
                      })}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="border-t pt-4">
        <h3 className="mb-2 font-semibold">{t("Meeting Rules")}</h3>
        <ol className="list-decimal space-y-2 pl-5">
          {rules.map((r) => (
            <li key={r.id}>
              <span className="text-muted-foreground">{t(kindLabels[r.kind])} · </span>
              {label(r)}
              {r.kind === "action" && (
                <span className="block text-xs text-muted-foreground">
                  {[
                    actionValidation(r).requireOwner && t("Owner required"),
                    actionValidation(r).requireDeadline && t("Deadline required"),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>
      {s.type !== "speaker" && speakers.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold">{t("Required Speakers")}</h3>
          {list(speakers)}
        </section>
      )}
    </div>
  );
}
