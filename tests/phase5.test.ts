import { afterEach, describe, expect, it, vi } from "vitest";
import {
  blankRequirements,
  deleteCustomTemplate,
  readCustomTemplates,
  saveCustomTemplate,
  writeCustomTemplates,
} from "@/lib/custom-templates";
import { createMeeting, scenarios } from "./fixtures/demo";
import { templates } from "@/lib/templates";
import { freshDemo, prepareMeeting, updateTranscript } from "./fixtures/meeting-state";
import {
  analysisRequestSchema,
  MAX_REQUEST_BYTES,
  MAX_TRANSCRIPT_LENGTH,
  transcriptError,
} from "@/lib/analysis-contract";
import { requestAnalysis } from "@/lib/analysis-client";
import { importTextFile } from "@/lib/transcript-import";
import { appendLiveUtterance, preparedDeepgramProvider } from "@/lib/live-transcription";
import { readMeetings, writeMeetings } from "@/lib/storage";
import { minimumKinds, removeRequirement } from "@/lib/requirements";
import { checkCompletion } from "@/lib/rule-engine";
import { analysisSchema } from "@/lib/models";

afterEach(() => vi.unstubAllGlobals());
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
const custom = () => ({
  ...structuredClone(templates[0]),
  id: "custom-test",
  name: "我的上线模板",
  defaultTitle: "自己的会议",
});
function file(text: string, name = "meeting.txt", type = "text/plain") {
  const bytes = new TextEncoder().encode(text);
  return { name, type, size: bytes.byteLength, arrayBuffer: async () => bytes.buffer };
}
describe("custom templates", () => {
  it("starts with exactly five empty, uniquely identified, nonremovable final entries", () => {
    const requirements = blankRequirements();
    expect(requirements.items.map((r) => r.kind)).toEqual(minimumKinds);
    expect(new Set(requirements.items.map((r) => r.id)).size).toBe(5);
    for (const r of requirements.items) {
      expect(r.label).toBe("");
      expect(removeRequirement(requirements, r.id).items).toHaveLength(5);
    }
  });
  it("saves, edits and reloads custom templates without changing built-ins", () => {
    const before = structuredClone(templates);
    let all = saveCustomTemplate([], custom());
    all = saveCustomTemplate(all, { ...custom(), name: "修改后的模板" });
    const local = storage();
    expect(writeCustomTemplates(local, all)).toBeNull();
    expect(readCustomTemplates(local).customTemplates).toEqual(all);
    expect(all).toHaveLength(1);
    expect(templates).toEqual(before);
  });
  it.each(["launch", "retro", "customer"])(
    "protects the %s built-in from writes and deletion",
    (id) => {
      expect(() => deleteCustomTemplate([], id)).toThrow("cannot be deleted");
      expect(() => saveCustomTemplate([], { ...custom(), id })).toThrow("cannot be changed");
    },
  );
  it("keeps meetings independent of subsequent template edits and deletion", () => {
    const template = custom();
    const meeting = createMeeting(template.id, "meeting", false, template);
    const original = structuredClone(meeting.requirements);
    template.defaultGoals[0].label = "Later change";
    const remaining = deleteCustomTemplate([template], template.id);
    expect(remaining).toEqual([]);
    expect(meeting.requirements).toEqual(original);
    const local = storage();
    writeMeetings(local, [meeting]);
    expect(readMeetings(local).meetings).toEqual([meeting]);
  });
  it("rejects empty template content and safely recovers corrupt storage", () => {
    expect(() =>
      saveCustomTemplate([], {
        ...custom(),
        defaultGoals: blankRequirements().items.filter((r) => r.kind === "goal"),
      }),
    ).toThrow();
    expect(
      readCustomTemplates({ getItem: () => "broken", setItem: () => {} }).warning,
    ).toBeTruthy();
  });
});
describe("UTF-8 transcript import and limits", () => {
  it("imports UTF-8 and BOM without altering newlines, then invalidates prior results", async () => {
    const text = "Devi: 今天确认上线条件。\r\nMax: 工程已准备好。";
    const decoded = await importTextFile(file("\ufeff" + text));
    expect(decoded).toBe(text);
    const edited = updateTranscript(prepareMeeting(freshDemo()), decoded, "会议.txt");
    expect(edited.analysis).toBeNull();
    expect(edited.completionCheck).toBeNull();
    const local = storage();
    writeMeetings(local, [edited]);
    expect(readMeetings(local).meetings[0].transcript.fileName).toBe("会议.txt");
  });
  it("accepts 50,000 Chinese characters, rejects 50,001 without truncation", async () => {
    expect(MAX_TRANSCRIPT_LENGTH).toBe(50_000);
    const text = "中".repeat(50_000);
    expect(await importTextFile(file(text))).toBe(text);
    expect(transcriptError(text)).toBeNull();
    await expect(importTextFile(file(text + "文"))).rejects.toThrow("TRANSCRIPT_TOO_LONG");
    expect(transcriptError(text + "文")).toBe("TRANSCRIPT_TOO_LONG");
    const meeting = freshDemo();
    const input = {
      requirements: meeting.requirements,
      templateId: "custom-test",
      transcript: { ...meeting.transcript, text },
    };
    expect(analysisRequestSchema.safeParse(input).success).toBe(true);
    expect(new TextEncoder().encode(JSON.stringify(input)).length).toBeLessThan(MAX_REQUEST_BYTES);
  });
  it("rejects nontext, malformed UTF-8, binary content, and read failures", async () => {
    await expect(importTextFile(file("hello", "file.pdf", "application/pdf"))).rejects.toThrow(
      ".txt",
    );
    await expect(importTextFile(file("hello", "file.txt", "image/png"))).rejects.toThrow(".txt");
    await expect(importTextFile(file("hello\u0000world"))).rejects.toThrow(".txt");
    await expect(
      importTextFile({
        ...file(""),
        size: 2,
        arrayBuffer: async () => new Uint8Array([0xff, 0xfe]).buffer,
      }),
    ).rejects.toThrow("UTF-8");
    await expect(
      importTextFile({
        ...file(""),
        arrayBuffer: async () => {
          throw new Error("permission");
        },
      }),
    ).rejects.toThrow("could not be read");
  });
});
describe("Chinese demo evidence", () => {
  it.each(scenarios)("matches every $id fixture to actual transcript evidence", (scenario) => {
    const chinese = scenario.transcript.match(/[\u4e00-\u9fff]/g) ?? [];
    expect(chinese.length).toBeGreaterThanOrEqual(1500);
    expect(chinese.length).toBeLessThanOrEqual(2500);
    const analysis = analysisSchema.parse({
      ...scenario.analysis,
      id: "test",
      transcriptRevision: 1,
      requirementsRevision: 1,
    });
    for (const e of analysis.evidence) {
      expect(scenario.transcript.split("\n")[Number(e.segmentId.replace("line-", "")) - 1]).toBe(
        `${e.speaker}：${e.quote}`,
      );
    }
    for (const item of [
      ...analysis.goals,
      ...analysis.conclusions,
      ...analysis.topics,
      ...analysis.speakers,
      ...analysis.decisions,
      ...analysis.actionItems,
      ...analysis.unresolvedIssues,
    ]) {
      expect(item.evidenceIds.length).toBeGreaterThan(0);
      for (const id of item.evidenceIds)
        expect(analysis.evidence.some((e) => e.id === id)).toBe(true);
    }
    for (const action of analysis.actionItems) {
      const text = analysis.evidence
        .filter((e) => action.evidenceIds.includes(e.id))
        .map((e) => `${e.speaker}：${e.quote}`)
        .join("\n");
      if (action.owner) expect(text).toContain(action.owner);
      if (action.deadline) expect(text).toContain(action.deadline);
    }
    const meeting = createMeeting(scenario.templateId, "test");
    const result = checkCompletion({
      ...meeting,
      analysis,
      actionItems: analysis.actionItems,
      transcriptRevision: 1,
    });
    expect(result.readiness).toBe(scenario.id === "launch-incomplete" ? "BLOCKED" : "READY");
  });
  it("continues the launch discussion without replacing prior utterances", () => {
    expect(scenarios[1].transcript.startsWith(scenarios[0].transcript)).toBe(true);
    expect(scenarios[0].analysis.actionItems[0].owner).toBeNull();
    expect(scenarios[0].analysis.actionItems[1].deadline).toBeNull();
    expect(scenarios[1].analysis.decisions[0].classification).toBe("decided");
  });
});
describe("safe client errors", () => {
  it.each(["MISSING_API_KEY", "TIMEOUT", "PROVIDER_ERROR", "INVALID_OUTPUT"])(
    "preserves safe %s codes",
    async (error) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error }, { status: 502 })));
      await expect(requestAnalysis(freshDemo())).rejects.toMatchObject({ code: error });
    },
  );
  it("never exposes arbitrary provider/server error text", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(Response.json({ error: "private diagnostic details" }, { status: 502 })),
    );
    await expect(requestAnalysis(freshDemo())).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
  });
});
describe("isolated live transcript preparation", () => {
  const final = {
    id: "utterance-1",
    speakerId: "Speaker 0",
    text: "同意按计划上线",
    isFinal: true,
    startMs: 0,
    endMs: 1000,
  };
  it("appends only finalized, unique utterances with an explicit speaker mapping", () => {
    expect(appendLiveUtterance("", [], { ...final, isFinal: false }, {}).text).toBe("");
    const first = appendLiveUtterance("", [], final, { "Speaker 0": "Devi" });
    expect(first.text).toBe("Devi: 同意按计划上线");
    expect(appendLiveUtterance(first.text, first.seenIds, final, {}).text).toBe(first.text);
    expect(() => appendLiveUtterance("x".repeat(50_000), [], final, {})).toThrow(
      "TRANSCRIPT_TOO_LONG",
    );
  });
  it("does not pretend that live recording is configured", async () => {
    expect(preparedDeepgramProvider.available).toBe(false);
    await expect(
      preparedDeepgramProvider.start({
        language: "zh",
        mimeType: "audio/webm",
        signal: new AbortController().signal,
        onUtterance: () => {},
        onError: () => {},
      }),
    ).rejects.toThrow("UNAVAILABLE");
  });
});
