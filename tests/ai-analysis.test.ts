import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { POST } from "@/app/api/analyze-meeting/route";
import { DeepSeekAnalysisProvider } from "@/lib/server/deepseek-provider";
import { normalizeExtraction } from "@/lib/server/extraction";
import { analysisSchema } from "@/lib/models";
import { freshDemo, applyAnalysis, evaluateMeeting, updateTranscript } from "./fixtures/meeting-state";
import { AnalysisInput, MAX_TRANSCRIPT_LENGTH } from "@/lib/analysis-contract";

function input(): AnalysisInput {
  const m = freshDemo();
  return {
    requirements: m.requirements,
    templateId: m.templateId,
    transcript: {
      text: "Maya · Product: We discussed Go / No-Go but made no decision. Jordan was invited but has not given an opinion.\nAlex · Engineering: We committed to publishing the monitoring checklist, but no owner or deadline was assigned.",
      revision: 2,
      scenarioId: null,
    },
  };
}
export function rawAnalysis() {
  return {
    goals: [],
    conclusions: [],
    topics: [],
    speakers: [
      {
        requirementId: "l-sales",
        status: "present_no_opinion",
        detail: "Invited, no opinion.",
        evidenceIds: ["e1"],
      },
    ],
    decisions: [
      {
        requirementId: "l-decision",
        status: "discussed_not_decided",
        outcome: null,
        detail: "No decision made.",
        evidenceIds: ["e1"],
      },
    ],
    actionItems: [
      {
        requirementId: "l-action-monitor",
        description: "Publish the monitoring checklist",
        owner: null,
        deadline: null,
        status: null,
        evidenceIds: ["e2"],
        ownerEvidenceId: null,
        deadlineEvidenceId: null,
      },
    ],
    unresolvedIssues: [],
    evidence: [
      {
        id: "e1",
        speaker: "Maya · Product",
        line: 1,
        quote:
          "We discussed Go / No-Go but made no decision. Jordan was invited but has not given an opinion.",
      },
      {
        id: "e2",
        speaker: "Alex · Engineering",
        line: 2,
        quote:
          "We committed to publishing the monitoring checklist, but no owner or deadline was assigned.",
      },
    ],
  };
}
function request(body: unknown = input(), headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/analyze-meeting", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
function reply(value: unknown = rawAnalysis()) {
  return new Response(
    JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify(value) } }],
    }),
    { status: 200 },
  );
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("server analysis route", () => {
  it.each(["", "short", "x".repeat(MAX_TRANSCRIPT_LENGTH + 1)])(
    "rejects invalid transcript length without calling the provider",
    async (text) => {
      const fetcher = vi.fn();
      vi.stubGlobal("fetch", fetcher);
      const value = input();
      value.transcript.text = text;
      const response = await POST(request(value));
      expect(response.status).toBe(text.length > MAX_TRANSCRIPT_LENGTH ? 413 : 400);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it("rejects invalid requirements and malformed request JSON", async () => {
    const value = input();
    value.requirements.items = [];
    expect((await POST(request(value))).status).toBe(400);
    expect(
      (
        await POST(
          new Request("http://localhost:3000/api/analyze-meeting", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{",
          }),
        )
      ).status,
    ).toBe(400);
  });
  it("rejects cross-origin requests", async () => {
    expect((await POST(request(input(), { origin: "https://other.example" }))).status).toBe(403);
  });
  it("reports missing API key without exposing configuration", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "MISSING_API_KEY" });
  });
  it("accepts a 50,000-character Chinese transcript with a custom template at the API boundary", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    const value = input();
    value.templateId = "custom-production-review";
    value.transcript.text = "中".repeat(50_000);
    const response = await POST(request(value));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "MISSING_API_KEY" });
  });
  it("keeps the key server-side and returns validated analysis, never an LLM completion check", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-secret-key");
    const fetcher = vi.fn().mockResolvedValue(reply());
    vi.stubGlobal("fetch", fetcher);
    const response = await POST(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(analysisSchema.safeParse(body.analysis).success).toBe(true);
    expect(JSON.stringify(body)).not.toContain("test-secret-key");
    expect(body).not.toHaveProperty("completionCheck");
    const sent = fetcher.mock.calls[0][1];
    expect(sent.headers.Authorization).toBe("Bearer test-secret-key");
    expect(JSON.parse(sent.body).response_format).toEqual({ type: "json_object" });
  });
  it("handles provider failures without returning upstream error bodies", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-secret-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("private upstream error", { status: 429 })),
    );
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "PROVIDER_ERROR" });
  });
  it("handles malformed LLM JSON and schemas", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-secret-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ finish_reason: "stop", message: { content: "not json" } }],
          }),
        ),
      ),
    );
    expect(await (await POST(request())).json()).toEqual({ error: "INVALID_OUTPUT" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ readiness: "READY" })));
    expect(await (await POST(request())).json()).toEqual({ error: "INVALID_OUTPUT" });
  });
  it("times out cleanly", async () => {
    const fetcher = vi.fn(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) =>
          init.signal.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          ),
        ),
    ) as unknown as typeof fetch;
    const provider = new DeepSeekAnalysisProvider({ apiKey: "test-key", timeoutMs: 10 }, fetcher);
    await expect(provider.analyze(input())).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});

describe("grounded structured extraction", () => {
  it("accepts explicitly supported owners and ISO deadlines", () => {
    const value = input();
    value.transcript.text +=
      "\nMaya · Product: Alex will publish the monitoring checklist by 2026-09-24.";
    const raw = {
      ...rawAnalysis(),
      evidence: [
        ...rawAnalysis().evidence,
        {
          id: "e3",
          speaker: "Maya · Product",
          line: 3,
          quote: "Alex will publish the monitoring checklist by 2026-09-24.",
        },
      ],
      actionItems: [
        {
          ...rawAnalysis().actionItems[0],
          owner: "Alex",
          deadline: "2026-09-24",
          ownerEvidenceId: "e3",
          deadlineEvidenceId: "e3",
          evidenceIds: ["e3"],
        },
      ],
    };
    expect(normalizeExtraction(raw, value).actionItems[0]).toMatchObject({
      owner: "Alex",
      deadline: "2026-09-24",
    });
  });
  it("supports timestamped first-person commitments without guessing from mere presence", () => {
    const value = input();
    value.transcript.text +=
      "\n[00:12] Alex · Engineering: I will publish the monitoring checklist.";
    const raw = {
      ...rawAnalysis(),
      evidence: [
        ...rawAnalysis().evidence,
        { id: "e3", speaker: "Alex", line: 3, quote: "I will publish the monitoring checklist." },
      ],
      actionItems: [
        {
          ...rawAnalysis().actionItems[0],
          owner: "Alex",
          ownerEvidenceId: "e3",
          evidenceIds: ["e3"],
        },
      ],
    };
    expect(normalizeExtraction(raw, value).actionItems[0]).toMatchObject({
      owner: "Alex",
      deadline: null,
    });
    expect(normalizeExtraction(raw, value).evidence[2].speaker).toBe("Alex · Engineering");
  });
  it("preserves exact quotes, speaker and line reference", () => {
    const result = normalizeExtraction(rawAnalysis(), input());
    expect(result.evidence[0]).toMatchObject({
      quote: rawAnalysis().evidence[0].quote,
      speaker: "Maya · Product",
      segmentId: "line-1",
      transcriptRevision: 2,
    });
  });
  it("rejects fabricated quotes, wrong line numbers, and speaker attribution", () => {
    const raw = rawAnalysis();
    raw.evidence[0].quote = "A fabricated final decision";
    expect(() => normalizeExtraction(raw, input())).toThrow("INVALID_OUTPUT");
    const wrong = rawAnalysis();
    wrong.evidence[0].speaker = "Jordan · Sales";
    expect(() => normalizeExtraction(wrong, input())).toThrow("INVALID_OUTPUT");
    const line = rawAnalysis();
    line.evidence[0].line = 7;
    expect(() => normalizeExtraction(line, input())).toThrow("INVALID_OUTPUT");
  });
  it("never fills missing owners or deadlines", () => {
    const analysis = normalizeExtraction(rawAnalysis(), input());
    expect(analysis.actionItems[0]).toMatchObject({
      owner: null,
      deadline: null,
      status: "unknown",
    });
  });
  it("discards invented owner and deadline values even in well-formed JSON", () => {
    const raw = {
      ...rawAnalysis(),
      actionItems: [
        {
          ...rawAnalysis().actionItems[0],
          owner: "Invented person",
          deadline: "2026-10-10",
          ownerEvidenceId: "e2",
          deadlineEvidenceId: "e2",
        },
      ],
    };
    expect(normalizeExtraction(raw, input()).actionItems[0]).toMatchObject({
      owner: null,
      deadline: null,
    });
  });
  it("preserves discussed_not_decided and speaker mentions as blocking facts", () => {
    const analysis = normalizeExtraction(rawAnalysis(), input());
    expect(analysis.decisions[0]).toMatchObject({
      status: "discussed",
      classification: "discussed_not_decided",
      outcome: null,
    });
    expect(analysis.speakers.find((s) => s.requirementId === "l-sales")).toMatchObject({
      status: "mentioned",
      classification: "present_no_opinion",
    });
    const meeting = applyAnalysis({ ...freshDemo(), transcript: input().transcript }, analysis);
    expect(evaluateMeeting(meeting).blockingGaps.map((g) => g.type)).toEqual(
      expect.arrayContaining([
        "speaker_missing",
        "decision_pending",
        "action_owner",
        "action_deadline",
      ]),
    );
  });
  it("does not count another speaker's quote as the required speaker's opinion", () => {
    const raw = rawAnalysis();
    raw.speakers[0].status = "expressed_opinion";
    expect(
      normalizeExtraction(raw, input()).speakers.find((s) => s.requirementId === "l-sales")?.status,
    ).toBe("mentioned");
  });
  it("does not trust a completed finding with no evidence", () => {
    const raw = {
      ...rawAnalysis(),
      goals: [
        {
          requirementId: "l-goal",
          status: "complete",
          detail: "Unsupported claim",
          evidenceIds: [],
        },
      ],
    };
    expect(normalizeExtraction(raw, input()).goals[0]).toMatchObject({
      status: "missing",
      detail: "",
    });
  });
  it("rejects readiness fields supplied by the LLM", () => {
    expect(() => normalizeExtraction({ ...rawAnalysis(), readiness: "READY" }, input())).toThrow(
      "INVALID_OUTPUT",
    );
  });
  it("rejects results after a transcript edit", () => {
    const m = freshDemo();
    const analysis = normalizeExtraction(rawAnalysis(), input());
    const edited = updateTranscript(m, "A new custom transcript with different discussion.");
    expect(() => applyAnalysis(edited, analysis, m.stateRevision)).toThrow("STALE_ANALYSIS");
  });
});
