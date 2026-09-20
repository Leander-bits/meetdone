import { describe, expect, it } from "vitest";
import {
  addSegment,
  compileRequirements,
  displayNameFromEmail,
  durationMinutes,
  initialStructure,
  moveItem,
  resizeSegment,
  reusableTemplate,
  validConfiguration,
  validParticipants,
  validSchedule,
  validStructure,
  timezoneOffset,
  scheduleText,
} from "@/lib/meeting-structure";
import {
  freshDemo,
  freshDemos,
  evaluateMeeting,
  updateRequirements,
  prepareMeeting,
  endMeeting,
  convertGap,
} from "@/lib/meeting-state";
import { blankTemplate, readCustomTemplates, TEMPLATES_STORAGE_KEY } from "@/lib/custom-templates";
import { templates } from "@/lib/templates";
import { migrateMeeting, readMeetings, STORAGE_KEY } from "@/lib/storage";
import { summaryFilename, summaryMarkdown } from "@/lib/summary-download";
import { requirementKey } from "@/lib/models";
import { finalEvaluation } from "@/lib/final-evaluation";
import { requirementLabel } from "@/lib/i18n";
import { meetingPresentation } from "@/lib/meeting-presentation";

const people = freshDemo().participants;
const goals = freshDemo().goals;
describe("meeting configuration", () => {
  it("shows the offset at the selected local time, including DST and fractional offsets", () => {
    expect(timezoneOffset("Europe/Berlin", "2026-01-15", "09:00")).toBe("UTC+01:00");
    expect(timezoneOffset("Europe/Berlin", "2026-07-15", "09:00")).toBe("UTC+02:00");
    expect(timezoneOffset("Europe/Berlin", "2026-03-29", "01:30")).toBe("UTC+01:00");
    expect(timezoneOffset("Europe/Berlin", "2026-03-29", "03:30")).toBe("UTC+02:00");
    expect(timezoneOffset("Europe/Berlin", "2026-03-29", "02:30")).toBe("");
    expect(timezoneOffset("Europe/Berlin", "2026-10-25", "02:30")).toBe("UTC+02:00 / UTC+01:00");
    expect(timezoneOffset("Asia/Kolkata", "2026-07-15", "09:00")).toBe("UTC+05:30");
    expect(timezoneOffset("UTC", "2026-07-15", "09:00")).toBe("UTC");
    expect(timezoneOffset("invalid", "2026-07-15", "09:00")).toBe("");
    expect(scheduleText({ date: "", startTime: "", endTime: "", timezone: "" })).toBeNull();
  });
  it("reuses required/optional role defaults without storing actual people", () => {
    const meeting = freshDemo();
    meeting.structure.type = "speaker";
    meeting.structure.requiredSpeakerIds = [];
    const t = reusableTemplate("custom-roles", "Roles", meeting);
    expect(t.roleRequirements.every((r) => !r.required)).toBe(true);
    expect(initialStructure("speaker", 30, people, t).requiredSpeakerIds).toEqual([]);
  });
  it("extracts an editable display name from an email", () => {
    expect(displayNameFromEmail(" zhaojiaheng@superintelligence.com ")).toBe("zhaojiaheng");
  });
  it("validates participants, duplicate emails and schedule boundaries", () => {
    expect(validParticipants(people)).toBe(true);
    expect(validParticipants([])).toBe(false);
    expect(validParticipants([...people, { ...people[0], id: "duplicate" }])).toBe(false);
    expect(validSchedule("2026-09-20", "09:00", "09:30", "Europe/Berlin")).toBe(true);
    for (const [date, start, end, zone] of [
      ["2026-02-30", "09:00", "09:30", "UTC"],
      ["2026-09-20", "10:00", "09:30", "UTC"],
      ["2026-09-20", "09:00", "09:33", "UTC"],
      ["2026-09-20", "09:00", "09:30", "invalid"],
    ])
      expect(validSchedule(date, start, end, zone)).toBe(false);
    expect(durationMinutes("09:00", "10:30")).toBe(90);
  });
  it("has reusable templates without participants, dates or transcripts", () => {
    for (const t of templates) {
      expect(t.defaultGoals.length).toBeGreaterThan(0);
      expect(t).not.toHaveProperty("participants");
      expect(t).not.toHaveProperty("defaultTitle");
      expect(JSON.stringify(t)).not.toMatch(/Devi|Max|Jiaheng|Bosch|@/);
    }
    const empty = blankTemplate();
    expect(empty.defaultGoals).toHaveLength(1);
    expect(empty.defaultGoals[0].label).toBe("");
    expect(empty.rules).toEqual([]);
    expect(empty.roleRequirements).toEqual([]);
  });
  it("saves reusable stage text without matrix participant assignments", () => {
    const meeting = freshDemos()[2];
    const t = reusableTemplate("custom-matrix", "My template", meeting);
    expect(t.defaultStages).toHaveLength(3);
    expect(JSON.stringify(t)).not.toMatch(/participantId|email|transcript/);
    expect(t.rules.every((r) => r.kind !== "speaker")).toBe(true);
    const reloaded = initialStructure("matrix", 30, people, t);
    expect(reloaded.stages[0].name).toBe(meeting.structure.stages[0].name);
    expect(reloaded.stages[0].assignments).toEqual([]);
  });
  it("keeps optional empty goals valid and requires nonempty meeting goals", () => {
    const s = initialStructure("time", 30, people);
    expect(validConfiguration(goals, s, people, 30, [])).toBe(true);
    expect(validConfiguration([{ ...goals[0], label: "" }], s, people, 30, [])).toBe(false);
  });
});
describe("timeline integrity", () => {
  it.each([5, 10, 25, 30, 55, 720])("allocates every minute of a %i minute meeting", (duration) => {
    let s = initialStructure("time", duration, people);
    expect(validStructure(s, duration, people)).toBe(true);
    for (let i = 0; i < s.segments.length; i++)
      for (const target of [0, 5, 13, 20, duration, duration + 10]) {
        s = { ...s, segments: resizeSegment(s.segments, s.segments[i].id, target) };
        expect(validStructure(s, duration, people)).toBe(true);
      }
  });
  it("adds and reorders segments without creating unassigned time", () => {
    const s = initialStructure("time", 30, people);
    s.segments = addSegment(s.segments, "Questions", "questions");
    expect(s.segments).toHaveLength(6);
    s.segments = moveItem(s.segments, 5, 0);
    expect(s.segments[0].id).toBe("questions");
    expect(validStructure(s, 30, people)).toBe(true);
    expect(addSegment(s.segments, "Too much", "extra")).toEqual(s.segments);
  });
  it("reuses saved custom timeline labels and goals", () => {
    const m = freshDemo();
    m.structure.segments[0].name = "Custom opening";
    const t = reusableTemplate("custom-time", "Time", m);
    expect(initialStructure("time", 60, people, t).segments[0].name).toBe("Custom opening");
  });
});
describe("ordered and stage-specific participation", () => {
  it("does not make speaking order a blocker", () => {
    const m = freshDemo();
    const s = initialStructure("speaker", 30, people);
    s.requiredSpeakerIds = [people[0].id];
    const requirements = compileRequirements(goals, s, people, []);
    const analysis = structuredClone(m.analysis!);
    analysis.requirementsRevision = 1;
    const r = requirements.items.find((r) => r.kind === "speaker")!;
    analysis.speakers = [
      {
        requirementId: r.id,
        requirementKey: requirementKey(r, requirements.items),
        status: "opinion",
        detail: "Relevant input",
        evidenceIds: [],
      },
    ];
    const before = evaluateMeeting({ ...m, requirements, analysis, actionItems: [] });
    s.speakerOrder.reverse();
    const after = evaluateMeeting({
      ...m,
      requirements: compileRequirements(goals, s, people, []),
      analysis,
      actionItems: [],
    });
    expect(after).toEqual(before);
    expect(after.blockingGaps).toEqual([]);
  });
  it("separates one person's required and optional assignments in multiple stages", () => {
    const m = freshDemos()[2];
    const speakers = m.requirements.items.filter(
      (r) => r.kind === "speaker" && r.label.startsWith("Alex"),
    );
    expect(speakers).toHaveLength(2);
    expect(speakers[0].topicId).not.toBe(speakers[1].topicId);
    const changed = structuredClone(m);
    changed.analysis!.speakers = changed.analysis!.speakers.filter(
      (f) => f.requirementId !== speakers[1].id,
    );
    expect(
      evaluateMeeting(changed).blockingGaps.some((g) => g.requirementId === speakers[1].id),
    ).toBe(true);
    const optional = m.requirements.items.find(
      (r) => r.kind === "speaker" && r.label.startsWith("Devi"),
    )!;
    expect(optional.level).toBe("record_only");
  });
  it("validates stage assignments and makes added stages immediately reorderable", () => {
    const s = initialStructure("matrix", 30, people);
    expect(validStructure(s, 30, people)).toBe(false);
    s.stages.forEach((stage) =>
      stage.assignments.push({ participantId: people[0].id, required: false }),
    );
    expect(validStructure(s, 30, people)).toBe(true);
    s.stages.push({
      id: "custom",
      name: "Questions",
      custom: true,
      goals: [{ id: "g", text: "" }],
      assignments: [],
    });
    s.stages = moveItem(s.stages, 5, 0);
    expect(s.stages[0].id).toBe("custom");
    expect(validStructure(s, 30, people)).toBe(false);
  });
  it("invalidates a check after structure addition or deletion", () => {
    const m = prepareMeeting(freshDemo());
    const s = initialStructure("stages", 30, people);
    const next = updateRequirements(m, compileRequirements(goals, s, people, []));
    expect(next.analysis).toBeNull();
    expect(next.completionCheck).toBeNull();
    s.stages.pop();
    const removed = updateRequirements(next, compileRequirements(goals, s, people, []));
    expect(removed.requirements.revision).toBe(3);
  });
});
describe("migration and prebuilt meetings", () => {
  it("seeds three fully configured independent meetings", () => {
    const demos = freshDemos();
    expect(demos.map((m) => m.structure.type)).toEqual(["time", "stages", "matrix"]);
    for (const m of demos) {
      expect(validSchedule(m.date, m.startTime, m.endTime, m.timezone)).toBe(true);
      expect(validParticipants(m.participants)).toBe(true);
      expect(validStructure(m.structure, 30, m.participants)).toBe(true);
      expect(m.transcript.text).not.toMatch(/Bosch|Atlas|Northstar/);
    }
    expect(evaluateMeeting(demos[1]).readiness).toBe("READY");
    expect(evaluateMeeting(demos[2]).readiness).toBe("READY");
  });
  it("preserves old records and ended summaries, without inventing participants", () => {
    const m = endMeeting(prepareMeeting(freshDemo()), "Accepted risk");
    const old: Record<string, unknown> = { ...m };
    for (const key of [
      "structure",
      "goals",
      "participants",
      "date",
      "startTime",
      "endTime",
      "timezone",
    ])
      delete old[key];
    const migrated = migrateMeeting(old)!;
    expect(migrated.summary).toEqual(m.summary);
    expect(migrated.transcript).toEqual(m.transcript);
    expect(migrated.participants).toEqual([]);
    expect(migrated.migrationNote).toBeTruthy();
  });
  it("isolates invalid records and keeps a recovery copy", () => {
    const map = new Map([
      [STORAGE_KEY, JSON.stringify({ version: 2, meetings: [freshDemo(), { id: "bad" }] })],
    ]);
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
    };
    const result = readMeetings(storage);
    expect(result.meetings).toHaveLength(1);
    expect(result.warning).toBeTruthy();
    expect(map.has("meetdone.workspace.recovery")).toBe(true);
  });
  it("migrates old custom templates without actual people or meeting titles", () => {
    const old = {
      version: 1,
      templates: [
        {
          id: "old-custom",
          name: "Old",
          defaultTitle: "A specific meeting",
          requirements: freshDemo().requirements,
        },
      ],
    };
    const result = readCustomTemplates({
      getItem: (key) => (key === TEMPLATES_STORAGE_KEY ? JSON.stringify(old) : null),
      setItem: () => {},
    });
    expect(result.customTemplates).toHaveLength(1);
    expect(result.customTemplates[0]).not.toHaveProperty("defaultTitle");
    expect(result.customTemplates[0].rules.some((r) => r.kind === "speaker")).toBe(false);
  });
});
describe("ending and download content", () => {
  it("localizes generated speaker roles and identifies each missing matrix stage", () => {
    const generated = {
      kind: "speaker",
      label: "My name（Engineering）",
      builtinKey: "My name（Engineering）",
    };
    expect(requirementLabel("zh", generated)).toBe("My name（技术）");
    expect(requirementLabel("en", generated)).toBe("My name（Engineering）");
    expect(requirementLabel("zh", { ...generated, builtinKey: undefined })).toBe(
      "My name（Engineering）",
    );
    const m = freshDemos()[2];
    m.analysis!.speakers = [];
    const gap = evaluateMeeting(m).blockingGaps.find(
      (g) => g.requirementId === "speaker-structure-next-alex",
    )!;
    expect(meetingPresentation(m, "zh").gapTitle(gap)).toContain("下一步");
    expect(meetingPresentation(m, "en").gapTitle(gap)).toContain("Next Steps");
  });
  it("localizes summary system text without translating or mutating user content", () => {
    const m = endMeeting(prepareMeeting(freshDemo()), "Assign an owner.");
    m.title = "My own meeting";
    m.builtinTitle = false;
    m.summary!.actionItems.push({
      id: "host-action",
      description: "Send the release notice",
      owner: "My owner",
      deadline: "2026-09-24",
      status: "open",
      source: "host",
      evidenceIds: [],
    });
    const snapshot = JSON.stringify(m);
    const zh = summaryMarkdown(m, "zh");
    const en = summaryMarkdown(m, "en");
    expect(zh).toContain("## 原始会议目标");
    expect(zh).toContain("## 剩余风险");
    expect(zh).toContain("请指定负责人");
    expect(zh).toContain("发送上线通知");
    expect(en).toContain("## Original Meeting Goals");
    expect(en).toContain("Assign an owner.");
    for (const output of [zh, en]) {
      expect(output).toContain("My own meeting");
      expect(output).toContain("| Send the release notice | My owner |");
      expect(output).toContain(": Assign an owner.");
      expect(output).toContain(m.summary!.conclusions[0]);
    }
    expect(JSON.stringify(m)).toBe(snapshot);
    m.date = "";
    m.startTime = "";
    m.endTime = "";
    m.timezone = "";
    expect(summaryMarkdown(m, "zh")).toContain("未记录会议时间");
    expect(summaryMarkdown(m, "en")).toContain("Schedule not recorded");
  });
  it("requires an owner and a date and preserves nondeferrable blockers", () => {
    const m = freshDemo();
    const gap = evaluateMeeting(m).blockingGaps.find((g) => g.type === "speaker_missing")!;
    const action = {
      id: "follow",
      description: "Ask Sun",
      owner: "Devi",
      deadline: "2026-09-24",
      status: "open" as const,
      source: "host" as const,
      evidenceIds: [],
    };
    expect(() => convertGap(m, gap, { ...action, owner: null })).toThrow();
    expect(() => convertGap(m, gap, { ...action, deadline: null })).toThrow();
    const next = convertGap(m, gap, action);
    expect(evaluateMeeting(next).blockingGaps.some((g) => g.id === gap.id)).toBe(true);
    expect(next.actionItems.at(-1)?.gapId).toBe(gap.id);
  });
  it("has six deterministic questions and separate follow-ups", () => {
    expect(finalEvaluation(freshDemo())).toHaveLength(6);
    expect(finalEvaluation(freshDemo()).at(-1)?.problem).toBe(true);
    const retro = freshDemos()[1];
    expect(evaluateMeeting(retro).followUpGaps.length).toBeGreaterThan(0);
    expect(finalEvaluation(retro).at(-1)?.problem).toBe(false);
  });
  it("exports evidence-supported conclusions, exceptions and a safe Markdown filename", () => {
    const m = endMeeting(prepareMeeting(freshDemo()), "Keep a record of the risk");
    m.title = "Review / project: one";
    m.builtinTitle = false;
    const text = summaryMarkdown(m, "en");
    expect(summaryFilename(m, "en")).toBe("MeetDone_Review _ project_ one_2026-09-23.md");
    for (const h of [
      "Original Meeting Goals",
      "Achieved Conclusions",
      "Decisions Made",
      "Unresolved Issues",
      "Action Items",
      "Remaining Risks",
      "Exceptions",
      "Final Status",
    ])
      expect(text).toContain(`## ${h}`);
    expect(text).toContain("Ended with Exceptions");
    expect(text).toContain("Keep a record of the risk");
    expect(text).not.toContain("2026-09-28");
    expect(m.summary?.readiness).toBe("BLOCKED");
  });
});
