import { describe, expect, it } from "vitest";
import { ActionItem, Meeting, Requirement, actionValidation, meetingSchema } from "@/lib/models";
import {
  analyzeMeeting,
  evaluateMeeting,
  freshDemo,
  loadScenario,
  prepareMeeting,
  endMeeting,
  updateRequirements,
} from "./fixtures/meeting-state";
import { coverageFor } from "@/lib/coverage";
import { finalEvaluation } from "@/lib/final-evaluation";
import { migrateMeeting } from "@/lib/storage";
import { templateSchema } from "@/lib/models";
import { reusableTemplate } from "@/lib/meeting-structure";
import { normalizeExtraction } from "@/lib/server/extraction";

function complete() {
  return analyzeMeeting(loadScenario(freshDemo(), "launch-complete"));
}
function incidental(overrides: Partial<ActionItem> = {}): ActionItem {
  return {
    id: "incidental",
    description: "Prepare test data",
    owner: "Lin",
    deadline: null,
    source: "ai",
    status: "open",
    evidenceIds: [],
    ...overrides,
  };
}
function support(m: Meeting) {
  const quote = "Security approval must be resolved before we can launch.";
  m.transcript.text += `\nMax: ${quote}`;
  m.analysis!.evidence.push({
    id: "security-evidence",
    speaker: "Max",
    quote,
    segmentId: "security-line",
    transcriptRevision: m.transcript.revision,
  });
  return ["security-evidence"];
}

describe("incidental action follow-ups", () => {
  it.each([
    { owner: "Lin", deadline: null, types: ["action_deadline"] },
    { owner: null, deadline: "2026-09-24", types: ["action_owner"] },
    { owner: null, deadline: null, types: ["action_owner", "action_deadline"] },
  ])("missing fields are follow-ups: $types", ({ owner, deadline, types }) => {
    const m = complete();
    m.actionItems.push(incidental({ owner, deadline }));
    const check = evaluateMeeting(m);
    expect(check).toMatchObject({ readiness: "READY", blockingGaps: [] });
    expect(check.followUpGaps.map((g) => g.type)).toEqual(types);
  });
  it("matches the three incidental tasks example and ends without an exception", () => {
    const m = complete();
    m.requirements.items = m.requirements.items.filter((r) => r.kind !== "action");
    m.actionItems = [
      "Develop first version",
      "Prepare test data",
      "Organize meeting scenarios",
    ].map((description, i) =>
      incidental({ id: `extra-${i}`, description, owner: i ? "Lin" : "Zhao" }),
    );
    const check = evaluateMeeting(m);
    expect(check).toMatchObject({ readiness: "READY", blockingGaps: [] });
    expect(check.followUpGaps).toHaveLength(3);
    expect(finalEvaluation(m)[4]).toMatchObject({ answer: false, problem: true, blocking: false });
    expect(finalEvaluation(m)[5]).toMatchObject({ answer: false, problem: false });
    const ended = endMeeting(prepareMeeting(m));
    expect(ended.lifecycle).toBe("ended");
    expect(ended.summary!.acceptedExceptions).toEqual([]);
    expect(ended.summary!.actionItems.every((a) => a.deadline === null)).toBe(true);
  });
  it.each(["deleted-action", "l-goal"])(
    "an incidental action with non-action link %s still surfaces as follow-up",
    (requirementId) => {
      const m = complete();
      m.actionItems.push(incidental({ requirementId }));
      expect(evaluateMeeting(m).followUpGaps).toHaveLength(1);
      expect(evaluateMeeting(m).readiness).toBe("READY");
    },
  );
});

describe("action validation flags", () => {
  it.each([true, false, undefined])("owner validation honors requireOwner=%s", (requireOwner) => {
    const m = complete();
    const a = m.actionItems[0];
    a.owner = null;
    const r = m.requirements.items.find((r) => r.id === a.requirementId)!;
    r.requireOwner = requireOwner;
    const needed = requireOwner !== false;
    expect(evaluateMeeting(m).blockingGaps.some((g) => g.type === "action_owner")).toBe(needed);
    expect(coverageFor(m, r).complete).toBe(!needed);
    expect(evaluateMeeting(m).followUpGaps).toEqual([]);
  });
  it.each([true, false, undefined])(
    "deadline validation honors requireDeadline=%s",
    (requireDeadline) => {
      const m = complete();
      const a = m.actionItems[0];
      a.deadline = null;
      const r = m.requirements.items.find((r) => r.id === a.requirementId)!;
      r.requireDeadline = requireDeadline;
      expect(evaluateMeeting(m).blockingGaps.some((g) => g.type === "action_deadline")).toBe(
        requireDeadline !== false,
      );
      expect(coverageFor(m, r).complete).toBe(requireDeadline === false);
      expect(evaluateMeeting(m).followUpGaps).toEqual([]);
    },
  );
  it("missing output still blocks when neither field is required", () => {
    const m = complete();
    const r = m.requirements.items.find((r) => r.kind === "action")!;
    r.requireOwner = false;
    r.requireDeadline = false;
    m.actionItems = m.actionItems.filter((a) => a.requirementId !== r.id);
    expect(evaluateMeeting(m).blockingGaps).toMatchObject([
      { type: "action_missing", requirementId: r.id },
    ]);
  });
  it("flags persist through meeting and reusable template serialization; edits invalidate checks", () => {
    const m = prepareMeeting(complete());
    const requirements = structuredClone(m.requirements);
    Object.assign(
      requirements.items.find((r) => r.kind === "action")!,
      { requireOwner: true, requireDeadline: false },
    );
    const edited = updateRequirements(m, requirements);
    expect(edited.analysis).toBeNull();
    expect(edited.completionCheck).toBeNull();
    const persisted = meetingSchema.parse(JSON.parse(JSON.stringify(edited)));
    expect(persisted.requirements.items.find((r) => r.kind === "action")).toMatchObject({
      requireOwner: true,
      requireDeadline: false,
    });
    const t = templateSchema.parse(reusableTemplate("custom-flags", "Flags", persisted));
    expect(t.rules.find((r) => r.kind === "action")).toMatchObject({
      requireOwner: true,
      requireDeadline: false,
    });
    expect(
      actionValidation(complete().requirements.items.find((r) => r.kind === "action")!),
    ).toEqual({ requireOwner: true, requireDeadline: true });
  });
});

describe("levels and outcome blockers", () => {
  it.each(["goal", "topic", "conclusion", "decision", "speaker", "action"] as const)(
    "missing recommended %s follows up; record-only is informational",
    (kind) => {
      const m = complete();
      const r: Requirement = {
        id: "extra",
        kind,
        label: "Secondary item",
        level: "recommended",
        allowsDeferral: false,
      };
      m.requirements.items.push(r);
      expect(evaluateMeeting(m)).toMatchObject({ readiness: "READY", blockingGaps: [] });
      expect(evaluateMeeting(m).followUpGaps).toHaveLength(1);
      r.level = "record_only";
      expect(evaluateMeeting(m).followUpGaps).toEqual([]);
      expect(evaluateMeeting(m).blockingGaps).toEqual([]);
    },
  );
  it("optional action outputs with incomplete fields cannot block", () => {
    const m = complete();
    const a = m.actionItems[0];
    a.owner = null;
    a.deadline = null;
    const r = m.requirements.items.find((r) => r.id === a.requirementId)!;
    r.level = "recommended";
    expect(evaluateMeeting(m).followUpGaps).toHaveLength(2);
    expect(evaluateMeeting(m).readiness).toBe("READY");
    r.level = "record_only";
    expect(evaluateMeeting(m).followUpGaps).toEqual([]);
  });
  it.each(["goal", "topic", "conclusion", "decision", "speaker", "action"] as const)(
    "missing required %s still blocks",
    (kind) => {
      const m = complete();
      m.requirements.items.push({
        id: "required",
        kind,
        label: "Core output",
        level: "required",
        allowsDeferral: false,
      });
      expect(evaluateMeeting(m).blockingGaps).toHaveLength(1);
      expect(finalEvaluation(m)[5].answer).toBe(true);
    },
  );
  it("required partial coverage and discussed decisions still block", () => {
    const m = complete();
    m.analysis!.topics[0].status = "partial";
    m.analysis!.decisions[0].status = "discussed";
    expect(evaluateMeeting(m).blockingGaps.map((g) => g.type)).toEqual(
      expect.arrayContaining(["topic_uncovered", "decision_pending"]),
    );
  });
  it("non-critical unresolved details follow up even when linked to a required goal", () => {
    const m = complete();
    m.analysis!.unresolvedIssues.push({
      id: "docs",
      description: "Polish supporting material",
      blocking: false,
      preventsOutcome: false,
      requirementId: "l-goal",
      evidenceIds: support(m),
    });
    expect(evaluateMeeting(m)).toMatchObject({ readiness: "READY", blockingGaps: [] });
    expect(evaluateMeeting(m).followUpGaps).toHaveLength(1);
    expect(finalEvaluation(m)[5].answer).toBe(false);
  });
  it("an evidenced issue preventing a required decision blocks", () => {
    const m = complete();
    m.analysis!.unresolvedIssues.push({
      id: "security",
      description: "Security approval pending",
      blocking: false,
      preventsOutcome: true,
      requirementId: "l-decision",
      evidenceIds: support(m),
    });
    expect(evaluateMeeting(m).blockingGaps).toMatchObject([{ type: "unresolved_issue" }]);
  });
  it("explicit critical evidence can block without an inferred requirement link", () => {
    const m = complete();
    m.analysis!.unresolvedIssues.push({
      id: "security",
      description: "Security approval pending",
      blocking: false,
      criticalEvidenceId: "security-evidence",
      evidenceIds: support(m),
    });
    expect(evaluateMeeting(m).blockingGaps).toHaveLength(1);
    m.analysis!.evidence.at(-1)!.transcriptRevision -= 1;
    expect(evaluateMeeting(m).readiness).toBe("READY");
  });
  it("an ungrounded legacy blocking flag is not a meeting veto", () => {
    const m = complete();
    m.analysis!.unresolvedIssues.push({
      id: "legacy",
      description: "Review the slide colors",
      blocking: true,
      evidenceIds: [],
    });
    expect(evaluateMeeting(m).readiness).toBe("READY");
    const issue = m.analysis!.unresolvedIssues[0];
    issue.requirementId = "l-decision";
    expect(evaluateMeeting(m).readiness).toBe("READY");
    issue.evidenceIds = support(m);
    expect(evaluateMeeting(m).readiness).toBe("BLOCKED");
  });
  it.each(["recommended", "record_only"] as const)(
    "an issue cannot override %s priority",
    (level) => {
      const m = complete();
      m.requirements.items.find((r) => r.id === "l-decision")!.level = level;
      m.analysis!.unresolvedIssues.push({
        id: "secondary",
        description: "Secondary detail",
        blocking: true,
        preventsOutcome: true,
        criticalEvidenceId: "security-evidence",
        requirementId: "l-decision",
        evidenceIds: support(m),
      });
      expect(evaluateMeeting(m).readiness).toBe("READY");
      expect(evaluateMeeting(m).followUpGaps).toHaveLength(level === "recommended" ? 1 : 0);
    },
  );
  it("refreshes active cached checks without rewriting ended summaries", () => {
    const m = complete();
    m.analysis!.provider = "deepseek";
    m.analysis!.unresolvedIssues.push({
      id: "note",
      description: "Prepare material",
      blocking: true,
      evidenceIds: [],
    });
    m.completionCheck = { ...evaluateMeeting(m), readiness: "BLOCKED" };
    expect(migrateMeeting(m)?.completionCheck?.readiness).toBe("READY");
    const ended = endMeeting(prepareMeeting(freshDemo()), "Historical exception");
    expect(migrateMeeting(ended)?.summary).toEqual(ended.summary);
  });
});

describe("extracted blocker facts", () => {
  const input = {
    requirements: complete().requirements,
    templateId: "launch",
    transcript: {
      text: "Max: Security approval must be resolved before we can launch.",
      revision: 1,
      scenarioId: null,
    },
  };
  const raw = {
    goals: [],
    topics: [],
    conclusions: [],
    speakers: [],
    decisions: [],
    actionItems: [],
    unresolvedIssues: [
      {
        description: "Security approval pending",
        requirementId: "l-decision",
        preventsOutcome: true,
        criticalEvidenceId: "e",
        evidenceIds: ["e"],
      },
    ],
    evidence: [
      {
        id: "e",
        line: 1,
        speaker: "Max",
        quote: "Security approval must be resolved before we can launch.",
      },
    ],
  };
  it("extracts supported facts without deciding gap severity", () => {
    expect(normalizeExtraction(raw, input).unresolvedIssues[0]).toMatchObject({
      blocking: false,
      preventsOutcome: true,
      criticalEvidenceId: "e",
    });
  });
  it("rejects fabricated critical evidence references", () => {
    const altered = structuredClone(raw);
    altered.unresolvedIssues[0].criticalEvidenceId = "invented";
    expect(() => normalizeExtraction(altered, input)).toThrow("INVALID_OUTPUT");
  });
});
