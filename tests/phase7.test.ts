import { afterEach, describe, expect, it, vi } from "vitest";
import { initialStructure, moveItem, removeSegment, validStructure } from "@/lib/meeting-structure";
import { sampleMeetings } from "@/lib/sample-meetings";
import { requestAnalysis } from "@/lib/analysis-client";
import { migrateMeeting, readMeetings, STORAGE_KEY } from "@/lib/storage";
import { orderedRequirements, requirementDisplay, ruleKinds } from "@/lib/requirement-display";
import { requirementLabel, translate } from "@/lib/i18n";
import { compileRequirements } from "@/lib/meeting-structure";
import { endMeeting, freshDemo, prepareMeeting } from "./fixtures/meeting-state";

afterEach(() => vi.unstubAllGlobals());
describe("timeline deletion", () => {
  it.each([0, 2, 4])(
    "redistributes segment %s and preserves identities, goals and full allocation",
    (index) => {
      const m = sampleMeetings()[0];
      const s = initialStructure("time", 30, m.participants);
      const before = structuredClone(s);
      s.segments = removeSegment(s.segments, s.segments[index].id);
      expect(s.segments).toHaveLength(4);
      expect(validStructure(s, 30, m.participants)).toBe(true);
      expect(s.segments.map((x) => x.id)).toEqual(
        before.segments.filter((_, i) => i !== index).map((x) => x.id),
      );
      for (const segment of s.segments)
        expect(segment.goals).toEqual(before.segments.find((b) => b.id === segment.id)!.goals);
      s.segments = moveItem(s.segments, 3, 0);
      expect(validStructure(s, 30, m.participants)).toBe(true);
    },
  );
  it("protects the final segment and ignores unknown IDs", () => {
    const s = initialStructure("time", 5, []);
    expect(removeSegment(s.segments, s.segments[0].id)).toEqual(s.segments);
    expect(removeSegment(s.segments, "unknown")).toEqual(s.segments);
  });
});

describe("AI-only product state", () => {
  it("seeds three sample transcripts without findings, extracted actions or completion", () => {
    for (const m of sampleMeetings()) {
      expect(m.transcript.text.length).toBeGreaterThan(1500);
      expect(m.analysis).toBeNull();
      expect(m.completionCheck).toBeNull();
      expect(m.actionItems).toEqual([]);
    }
  });
  it("removes active mock findings but preserves content, host actions and a recovery copy", () => {
    const m = prepareMeeting(freshDemo());
    m.actionItems.push({
      ...m.actionItems[0],
      id: "host-action",
      source: "host",
      description: "My action",
    });
    const raw = JSON.stringify({ version: 3, meetings: [m] });
    const store = new Map([[STORAGE_KEY, raw]]);
    const recovered = readMeetings({
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => {
        store.set(k, v);
      },
    }).meetings[0];
    expect(recovered.analysis).toBeNull();
    expect(recovered.completionCheck).toBeNull();
    expect(recovered.transcript).toEqual(m.transcript);
    expect(recovered.requirements).toEqual(m.requirements);
    expect(recovered.actionItems).toEqual([{ ...m.actionItems.at(-1), evidenceIds: [] }]);
    expect(store.get("meetdone.workspace.recovery")).toBe(raw);
  });
  it("retains genuine AI results and historical ended summaries", () => {
    const m = freshDemo();
    m.analysis!.provider = "deepseek";
    expect(migrateMeeting(m)?.analysis).toEqual(m.analysis);
    const ended = endMeeting(prepareMeeting(freshDemo()), "Recorded historical exception");
    expect(migrateMeeting(ended)?.summary).toEqual(ended.summary);
  });
  it("also clears stale legacy mock actions", () => {
    const m = freshDemo();
    m.transcript.revision += 1;
    expect(migrateMeeting(m)?.actionItems).toEqual([]);
    expect(migrateMeeting(m)?.analysis).toBeNull();
  });
  it("rejects a mock-provider HTTP response rather than labeling it AI", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ analysis: freshDemo().analysis })),
    );
    await expect(requestAnalysis(sampleMeetings()[0])).rejects.toThrow("INVALID_OUTPUT");
  });
  it.each(["MISSING_API_KEY", "TIMEOUT", "INVALID_OUTPUT", "PROVIDER_ERROR"])(
    "%s never produces a result or modifies the meeting",
    async (code) => {
      const m = sampleMeetings()[0],
        before = structuredClone(m);
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(Response.json({ error: code }, { status: 503 })),
      );
      await expect(requestAnalysis(m)).rejects.toThrow(code);
      expect(m).toEqual(before);
    },
  );
});

describe("requirement presentation", () => {
  it("orders topics, conclusions, decisions, actions without mutating requirements", () => {
    const rules = sampleMeetings()[0].requirements.items.filter((r) =>
      ruleKinds.some((kind) => r.kind === kind),
    );
    const before = structuredClone(rules);
    const order = orderedRequirements(rules).map((r) =>
      ruleKinds.indexOf(r.kind as (typeof ruleKinds)[number]),
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(rules).toEqual(before);
  });
  it("labels source, stage and user text in both languages without leaking IDs", () => {
    const m = sampleMeetings()[0];
    const stage = m.structure.segments[0];
    stage.goals[0].text = "我的目标 remains unchanged";
    stage.goals[0].builtinKey = undefined;
    m.requirements = compileRequirements(m.goals, m.structure, m.participants, []);
    const r = m.requirements.items.find((r) => r.id === `structure-goal-${stage.goals[0].id}`)!;
    for (const locale of ["zh", "en"] as const) {
      const text = requirementDisplay(
        m,
        r,
        (key) => translate(locale, key),
        (r) => requirementLabel(locale, r),
      );
      expect(text).toBe(
        `${translate(locale, "Time Sequence")} · ${translate(locale, "Opening")} · 我的目标 remains unchanged`,
      );
      expect(text).not.toContain(r.id);
    }
  });
});
