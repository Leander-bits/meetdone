import { describe, expect, it } from "vitest";
import {
  freshDemo,
  prepareMeeting,
  updateRequirements,
  updateTranscript,
  analyzeMeeting,
} from "@/lib/meeting-state";
import { minimumKinds, removeRequirement, validRequirementLists } from "@/lib/requirements";
import { templates } from "@/lib/templates";
import { scenarios } from "@/lib/demo";
import { translate, zh } from "@/lib/i18n";
import { readMeetings, writeMeetings } from "@/lib/storage";

describe("dynamic requirement lists", () => {
  it.each(minimumKinds)("cannot remove the last %s", (kind) => {
    let requirements = freshDemo().requirements;
    for (const r of requirements.items.filter((r) => r.kind === kind))
      requirements = removeRequirement(requirements, r.id);
    expect(requirements.items.filter((r) => r.kind === kind)).toHaveLength(1);
  });
  it("addition and deletion invalidate analysis and previous completion", () => {
    const m = prepareMeeting(freshDemo());
    const added = updateRequirements(m, {
      ...m.requirements,
      items: [
        ...m.requirements.items,
        {
          id: "new-goal",
          kind: "goal",
          label: "New requirement",
          level: "required",
          allowsDeferral: false,
        },
      ],
    });
    expect(added.analysis).toBeNull();
    expect(added.completionCheck).toBeNull();
    const checked = prepareMeeting(analyzeMeeting(added));
    const removed = updateRequirements(
      checked,
      removeRequirement(checked.requirements, "new-goal"),
    );
    expect(removed.analysis).toBeNull();
    expect(removed.completionCheck).toBeNull();
  });
  it("guards minimum counts below the UI", () => {
    const m = freshDemo();
    const invalid = {
      ...m.requirements,
      items: m.requirements.items.filter((r) => r.kind !== "goal"),
    };
    expect(validRequirementLists(invalid)).toBe(false);
    expect(() => updateRequirements(m, invalid)).toThrow("at least one");
  });
  it("persists arbitrary new IDs and user-entered Chinese without modification", () => {
    const m = freshDemo();
    m.requirements.items.push({
      id: "stable-custom",
      kind: "topic",
      label: "确认客户预算",
      level: "recommended",
      allowsDeferral: true,
    });
    let saved = "";
    const storage = {
      getItem: () => saved,
      setItem: (_k: string, v: string) => {
        saved = v;
      },
    };
    writeMeetings(storage, [m]);
    expect(readMeetings(storage).meetings[0].requirements).toEqual(m.requirements);
  });
  it("custom transcript still cannot receive fabricated demo analysis", () => {
    expect(() => analyzeMeeting(updateTranscript(freshDemo(), "User content"))).toThrow(
      "Demo analysis requires",
    );
  });
});
describe("bilingual built-ins", () => {
  it("localizes all demo scenario choices", () => {
    for (const scenario of scenarios) expect(zh[scenario.name], scenario.name).toBeTruthy();
  });
  it("preserves demo quotes at the referenced transcript lines, including blank separators", () => {
    for (const scenario of scenarios)
      for (const evidence of scenario.analysis.evidence) {
        const line = Number(evidence.segmentId.replace("line-", ""));
        expect(scenario.transcript.split("\n")[line - 1]).toContain(evidence.quote);
      }
  });
  it("has Chinese text for all template names, descriptions, titles and requirements", () => {
    for (const template of templates)
      for (const text of [
        template.name,
        ...template.defaultGoals.map((r) => r.label),
        ...template.rules.map((r) => r.label),
      ])
        expect(zh[text], text).toBeTruthy();
  });
  it("translates UI placeholders without translating inserted user content", () => {
    expect(
      translate("zh", "“{description}” has no owner.", { description: "My own action" }),
    ).toContain("My own action");
  });
});
