import { describe, expect, it } from "vitest";
import {
  analyzeMeeting,
  convertGap,
  endMeeting,
  evaluateMeeting,
  freshDemo,
  loadScenario,
  prepareMeeting,
  updateActionItems,
  updateRequirements,
  updateTranscript,
} from "./fixtures/meeting-state";
import { createMeeting } from "./fixtures/demo";
import { demoAnalysisProvider } from "./fixtures/analysis-provider";
import { ActionItem, Gap, Meeting } from "@/lib/models";

function complete() {
  return analyzeMeeting(loadScenario(freshDemo(), "launch-complete"));
}
function followUp(gap: Gap): ActionItem {
  return {
    id: "followup-1",
    gapId: gap.id,
    description: `Resolve ${gap.title}`,
    owner: "Maya",
    deadline: "2026-09-25",
    status: "open",
    source: "host",
    evidenceIds: [],
  };
}
describe("deterministic completion rules", () => {
  it("speaker opinions do not transfer to a renamed topic", () => {
    let m = complete();
    m = updateRequirements(m, {
      ...m.requirements,
      items: m.requirements.items.map((r) =>
        r.id === "l-topic-readiness" ? { ...r, label: "Security certification" } : r,
      ),
    });
    m = analyzeMeeting(m);
    expect(m.analysis?.speakers).toHaveLength(0);
    expect(
      evaluateMeeting(m).blockingGaps.filter((g) => g.type === "speaker_missing"),
    ).toHaveLength(3);
  });
  it("reanalysis preserves host edits without duplicating extracted actions", () => {
    let m = freshDemo();
    m = updateActionItems(
      m,
      m.actionItems.map((a, i) =>
        i === 0 ? { ...a, owner: "Host-assigned owner", source: "host" } : a,
      ),
    );
    m = analyzeMeeting(m);
    expect(m.actionItems).toHaveLength(2);
    expect(evaluateMeeting(m).blockingGaps.some((g) => g.type === "action_owner")).toBe(false);
  });
  it("draft action descriptions persist as an explicit incomplete output", () => {
    const m = complete();
    m.actionItems[0].description = "";
    expect(evaluateMeeting(m).blockingGaps.some((g) => g.type === "action_missing")).toBe(true);
  });
  it("rejects impossible calendar deadlines", () => {
    const m = complete();
    m.actionItems[0].deadline = "2026-02-30";
    expect(evaluateMeeting(m).blockingGaps.some((g) => g.type === "action_deadline")).toBe(true);
  });
  it("transcript edits preserve historical gap/action links without reusing their resolutions", () => {
    const m = freshDemo();
    const gap = evaluateMeeting(m).blockingGaps[0];
    const edited = updateTranscript(convertGap(m, gap, followUp(gap)), "New transcript");
    expect(edited.actionItems.find((a) => a.id === "followup-1")?.gapId).toBe(gap.id);
    expect(edited.gapResolutions).toEqual([]);
  });
  it("detects exactly the four incomplete launch blockers", () => {
    expect(
      evaluateMeeting(freshDemo())
        .blockingGaps.map((g) => g.type)
        .sort(),
    ).toEqual(["action_deadline", "action_owner", "decision_pending", "speaker_missing"]);
  });
  it("missing required speaker is blocking, including a speaker who is only mentioned", () => {
    const m = freshDemo();
    const gap = evaluateMeeting(m).blockingGaps.find((g) => g.type === "speaker_missing");
    expect(gap?.requirementId).toBe("l-sales");
    expect(gap?.explanation).toContain("mentioned");
    m.analysis!.speakers = m.analysis!.speakers.filter((s) => s.requirementId !== "l-sales");
    expect(evaluateMeeting(m).blockingGaps.some((g) => g.type === "speaker_missing")).toBe(true);
  });
  it("required decision discussed but not decided is blocking", () => {
    expect(
      evaluateMeeting(freshDemo()).blockingGaps.find((g) => g.type === "decision_pending")
        ?.explanation,
    ).toContain("Discussed, not decided");
  });
  it("required action missing owner is blocking", () => {
    expect(
      evaluateMeeting(freshDemo()).blockingGaps.find((g) => g.type === "action_owner")
        ?.requirementId,
    ).toBe("l-action-comms");
  });
  it("required action missing deadline is blocking", () => {
    expect(
      evaluateMeeting(freshDemo()).blockingGaps.find((g) => g.type === "action_deadline")
        ?.requirementId,
    ).toBe("l-action-monitor");
  });
  it("only recommended and nonessential follow-up gaps allow readiness", () => {
    const m = analyzeMeeting(loadScenario(createMeeting("retro", "retro-test"), "retro-complete"));
    m.analysis!.unresolvedIssues.push({
      id: "tooling",
      description: "Explore a tooling improvement",
      blocking: false,
      evidenceIds: [],
    });
    const check = evaluateMeeting(m);
    expect(check.followUpGaps).toHaveLength(2);
    expect(check.readiness).toBe("READY");
  });
  it("zero blocking gaps is ready", () => {
    expect(evaluateMeeting(complete())).toMatchObject({ readiness: "READY", blockingGaps: [] });
  });
  it("ending with exception does not mean ready, and records every accepted blocker", () => {
    const ended = endMeeting(
      prepareMeeting(freshDemo()),
      "Launch leadership accepts the pending work.",
    );
    expect(ended.lifecycle).toBe("ended_with_exceptions");
    expect(ended.completionCheck?.readiness).toBe("BLOCKED");
    expect(ended.summary?.readiness).toBe("BLOCKED");
    expect(ended.summary?.acceptedExceptions).toHaveLength(4);
    expect(ended.summary?.decisions).toEqual([]);
  });
  it("requirement edits invalidate the previous completion and analysis", () => {
    const m = prepareMeeting(complete());
    const edited = updateRequirements(m, {
      ...m.requirements,
      items: [
        ...m.requirements.items,
        { id: "legal", kind: "speaker", label: "Legal", level: "required", allowsDeferral: false },
      ],
    });
    expect(edited.completionCheck).toBeNull();
    expect(edited.analysis).toBeNull();
    expect(edited.requirements.revision).toBe(2);
    expect(evaluateMeeting(edited).readiness).toBe("BLOCKED");
    const analyzed = analyzeMeeting(edited);
    expect(evaluateMeeting(analyzed).blockingGaps.some((g) => g.requirementId === "legal")).toBe(
      true,
    );
  });
  it("transcript edits clear analysis, completion, and resolutions", () => {
    const edited = updateTranscript(prepareMeeting(complete()), "An arbitrary discussion");
    expect(edited.analysis).toBeNull();
    expect(edited.completionCheck).toBeNull();
    expect(edited.transcript.scenarioId).toBeNull();
    expect(() => demoAnalysisProvider.analyze(edited)).toThrow("Demo analysis requires");
  });
  it("renamed requirements never inherit old fixture evidence", () => {
    let m = complete();
    m = updateRequirements(m, {
      ...m.requirements,
      items: m.requirements.items.map((r) =>
        r.id === "l-decision" ? { ...r, label: "Approve a different launch" } : r,
      ),
    });
    m = analyzeMeeting(m);
    expect(m.analysis?.decisions).toHaveLength(0);
    expect(evaluateMeeting(m).blockingGaps.some((g) => g.type === "decision_missing")).toBe(true);
  });
  it("required action outputs are checked even when no actions were extracted", () => {
    const m = complete();
    m.actionItems = [];
    expect(evaluateMeeting(m).blockingGaps.filter((g) => g.type === "action_missing")).toHaveLength(
      2,
    );
  });
  it("rejects stale analysis revisions", () => {
    const m = complete();
    m.analysis!.transcriptRevision -= 1;
    expect(evaluateMeeting(m).blockingGaps[0].type).toBe("analysis_missing");
  });
  it("blocks uncovered goals, topics, conclusions, and outcome-blocking issues", () => {
    const m = complete();
    m.analysis!.goals = [];
    m.analysis!.topics = [];
    m.analysis!.conclusions = [];
    m.analysis!.evidence.push({
      id: "security",
      quote: "Security approval is pending and prevents release.",
      speaker: "Max",
      segmentId: "line-security",
      transcriptRevision: m.transcript.revision,
    });
    m.transcript.text += "\nMax: Security approval is pending and prevents release.";
    m.analysis!.unresolvedIssues.push({
      id: "security",
      description: "Security approval is pending",
      blocking: true,
      requirementId: "l-decision",
      evidenceIds: ["security"],
    });
    expect(new Set(evaluateMeeting(m).blockingGaps.map((g) => g.type))).toEqual(
      new Set(["goal_uncovered", "topic_uncovered", "conclusion_missing", "unresolved_issue"]),
    );
  });
  it("record-only items do not gate readiness", () => {
    const m = complete();
    m.requirements.items.push({
      id: "notes",
      kind: "topic",
      label: "Optional context",
      level: "record_only",
      allowsDeferral: false,
    });
    expect(evaluateMeeting(m).readiness).toBe("READY");
  });
  it("converting a non-deferrable decision into an action preserves the blocker", () => {
    const m = freshDemo();
    const gap = evaluateMeeting(m).blockingGaps.find((g) => g.type === "decision_pending")!;
    const converted = convertGap(m, gap, followUp(gap));
    expect(evaluateMeeting(converted).blockingGaps.some((g) => g.id === gap.id)).toBe(true);
    expect(converted.gapResolutions[0].actionItemId).toBe("followup-1");
  });
  it("explicit deferral with owner and deadline resolves the blocker without inventing a decision", () => {
    const m = freshDemo();
    m.requirements.items.find((r) => r.id === "l-decision")!.allowsDeferral = true;
    const gap = evaluateMeeting(m).blockingGaps.find((g) => g.type === "decision_pending")!;
    const converted = convertGap(m, gap, followUp(gap));
    expect(evaluateMeeting(converted).deferredGapIds).toContain(gap.id);
    expect(converted.analysis?.decisions[0].status).toBe("discussed");
    const broken = updateActionItems(
      converted,
      converted.actionItems.map((a) => (a.id === "followup-1" ? { ...a, owner: "" } : a)),
    );
    expect(evaluateMeeting(broken).blockingGaps.some((g) => g.id === gap.id)).toBe(true);
  });
  it("rejects deferrals without an owner or date", () => {
    const m = freshDemo();
    const gap = evaluateMeeting(m).blockingGaps[0];
    expect(() => convertGap(m, gap, { ...followUp(gap), owner: " " })).toThrow("owner");
    expect(() => convertGap(m, gap, { ...followUp(gap), deadline: "tomorrow" })).toThrow(
      "deadline",
    );
  });
  it("action edits invalidate a check, and ending requires a fresh check", () => {
    const m = prepareMeeting(complete());
    const edited = updateActionItems(
      m,
      m.actionItems.map((a) => ({ ...a, owner: "" })),
    );
    expect(edited.completionCheck).toBeNull();
    expect(() => endMeeting(edited, "Accepted")).toThrow("Prepare");
  });
  it("requires an exception reason and never permits ending unanalyzed text", () => {
    expect(() => endMeeting(prepareMeeting(freshDemo()), " ")).toThrow("reason");
    expect(() =>
      endMeeting(prepareMeeting(updateTranscript(freshDemo(), "Custom")), "Accepted"),
    ).toThrow("Analyze");
  });
  it("ended meetings are immutable and complete summaries preserve validated actions", () => {
    const ended = endMeeting(prepareMeeting(complete()));
    expect(ended.lifecycle).toBe("ended");
    expect(ended.summary?.decisions).toHaveLength(1);
    expect(ended.summary?.actionItems).toHaveLength(2);
    expect(() => updateTranscript(ended, "edited")).toThrow("ended");
    expect(() => updateRequirements(ended, ended.requirements)).toThrow("ended");
  });
  it("is deterministic and does not mutate input", () => {
    const m: Meeting = freshDemo();
    const before = structuredClone(m);
    expect(evaluateMeeting(m)).toEqual(evaluateMeeting(m));
    expect(m).toEqual(before);
  });
});
