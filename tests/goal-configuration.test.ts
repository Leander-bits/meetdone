import { describe, expect, it } from "vitest";
import {
  compileGoalRequirements,
  documentGoals,
  upgradeGoalConfiguration,
  validGoalConfiguration,
  visibleTemplate,
} from "@/lib/goal-configuration";
import { initialStructure } from "@/lib/meeting-structure";
import { freshDemo, endMeeting, prepareMeeting } from "./fixtures/meeting-state";
import { readMeetings, STORAGE_KEY, writeMeetings } from "@/lib/storage";
import { sampleMeetings } from "@/lib/sample-meetings";
import { templates } from "@/lib/templates";
import { translate } from "@/lib/i18n";
import { buildSummary } from "@/lib/meeting-state";
import { summaryMarkdown } from "@/lib/summary-download";

describe("visible goal configuration", () => {
  it("keeps oversized legacy content readable after saving, instead of dropping the record", () => {
    const m = freshDemo();
    m.goals[0].label = "Original user text";
    m.requirements.items = [
      m.goals[0],
      ...Array.from({ length: 15 }, (_, i) => ({
        id: `old-${i}`,
        kind: "topic" as const,
        label: `${i} ${"Long user content ".repeat(26)}`,
        level: "recommended" as const,
        allowsDeferral: false,
      })),
    ];
    const values = new Map([[STORAGE_KEY, JSON.stringify({ version: 3, meetings: [m] })]]);
    const storage = {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => {
        values.set(k, v);
      },
    };
    const migrated = readMeetings(storage).meetings;
    expect(migrated).toHaveLength(1);
    expect(migrated[0].goals[0].label.length).toBeGreaterThan(5000);
    expect(migrated[0].migrationNote).toContain("Imported goals need review");
    writeMeetings(storage, migrated);
    expect(readMeetings(storage).meetings).toEqual(migrated);
  });
  it("summaries retain the entire original goal document, including typed outcomes", () => {
    const m = sampleMeetings()[0];
    m.analysis = freshDemo().analysis;
    m.summary = buildSummary(m, "2026-09-30T12:00:00Z");
    expect(m.summary.originalGoal).toBe(m.goals[0].label);
    expect(summaryMarkdown(m, "zh")).toContain("行动项：发送发布通知");
    expect(summaryMarkdown(m, "en")).toContain("行动项：发送发布通知");
  });
  it("compiles explicit outcomes without creating hidden default rules", () => {
    const s = initialStructure("time", 30, []);
    const goals = documentGoals("确认上线\n议题：风险\n决策：是否上线\n行动项：发布通知");
    const result = compileGoalRequirements(goals, s, []);
    expect(result.items.filter((r) => r.level === "required").map((r) => r.label)).toEqual([
      "确认上线",
      "风险",
      "是否上线",
      "发布通知",
    ]);
    expect(validGoalConfiguration(documentGoals("决策：是否上线"), s, [], 30)).toBe(true);
    expect(
      compileGoalRequirements(documentGoals("New outcome"), s, []).items.some(
        (r) => r.kind === "action",
      ),
    ).toBe(false);
  });
  it("preserves legacy levels, speakers, flags, and host actions visibly and invalidates results", () => {
    const m = freshDemo();
    m.requirements.items.push(
      {
        id: "speaker-custom",
        kind: "speaker",
        label: "Custom stakeholder",
        level: "required",
        allowsDeferral: false,
      },
      {
        id: "optional",
        kind: "action",
        label: "Supporting material",
        level: "recommended",
        allowsDeferral: true,
        requireOwner: true,
        requireDeadline: false,
      },
      { id: "record", kind: "topic", label: "FYI", level: "record_only", allowsDeferral: false },
    );
    const migrated = upgradeGoalConfiguration(m);
    expect(migrated.goals).toHaveLength(1);
    expect(migrated.goals[0].label).toContain("Speaker: Custom stakeholder");
    expect(migrated.goals[0].label).toContain("recommended; deferrable; deadline optional");
    expect(
      migrated.requirements.items.find((r) => r.label === "Supporting material"),
    ).toMatchObject({
      level: "recommended",
      requireDeadline: false,
      requireOwner: true,
      allowsDeferral: true,
    });
    expect(migrated.requirements.items.find((r) => r.label === "FYI")?.level).toBe("record_only");
    expect(migrated.analysis).toBeNull();
    expect(migrated.completionCheck).toBeNull();
    expect(migrated.transcript).toEqual(m.transcript);
    expect(upgradeGoalConfiguration(migrated)).toEqual(migrated);
    const removed = compileGoalRequirements(
      documentGoals("Replacement goal"),
      migrated.structure,
      migrated.participants,
    );
    expect(
      removed.items.some(
        (r) => r.label === "Custom stakeholder" || r.label === "Supporting material",
      ),
    ).toBe(false);
  });
  it("retains archived summaries and keeps a recoverable, idempotent localStorage migration", () => {
    const ended = endMeeting(prepareMeeting(freshDemo()), "Recorded risk");
    expect(upgradeGoalConfiguration(ended)).toEqual(ended);
    const raw = JSON.stringify({ version: 4, meetings: [freshDemo()] });
    const values = new Map([[STORAGE_KEY, raw]]);
    const storage = {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => {
        values.set(k, v);
      },
    };
    const migrated = readMeetings(storage);
    expect(values.get("meetdone.workspace.recovery")).toBe(raw);
    expect(migrated.warning).toBeNull();
    writeMeetings(storage, migrated.meetings);
    expect(readMeetings(storage).meetings).toEqual(migrated.meetings);
  });
  it("keeps inactive structure goals out of analysis and stage text visible", () => {
    const m = sampleMeetings()[1];
    m.structure.stages[0].goals = [{ id: "mixed", text: "Confirm scope\nDecision: Approve" }];
    let req = compileGoalRequirements(m.goals, m.structure, m.participants);
    expect(req.items.find((r) => r.id === "structure-goal-mixed")?.label).toContain(
      "Confirm scope",
    );
    expect(req.items.find((r) => r.id === "structure-goal-mixed-line-1")?.kind).toBe("decision");
    m.structure.type = "speaker";
    req = compileGoalRequirements(m.goals, m.structure, m.participants);
    expect(req.items.some((r) => r.id.includes("mixed"))).toBe(false);
  });
  it("templates have visible translated defaults and no separate rules", () => {
    for (const locale of ["zh", "en"] as const) {
      for (const template of templates) {
        const visible = visibleTemplate(template, (text) => translate(locale, text));
        expect(visible.rules).toEqual([]);
        expect(visible.defaultGoals).toHaveLength(1);
        expect(visibleTemplate(visible)).toEqual(visible);
      }
    }
  });
  it("all three new samples are valid content-only meetings", () => {
    for (const m of sampleMeetings()) {
      expect(m.analysis).toBeNull();
      expect(m.configurationVersion).toBe(2);
      expect(m.goals).toHaveLength(1);
      expect(validGoalConfiguration(m.goals, m.structure, m.participants, 30)).toBe(true);
      expect(m.requirements).toEqual(compileGoalRequirements(m.goals, m.structure, m.participants));
    }
  });
});
