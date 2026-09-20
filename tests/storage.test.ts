import { describe, expect, it } from "vitest";
import { freshDemo, endMeeting, prepareMeeting } from "@/lib/meeting-state";
import { readMeetings, STORAGE_KEY, writeMeetings } from "@/lib/storage";
function memoryStorage(initial?: string) {
  const map = new Map<string, string>(initial ? [[STORAGE_KEY, initial]] : []);
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, value: string) => {
      map.set(k, value);
    },
  };
}
describe("versioned local persistence", () => {
  it("preserves legacy requirements without inventing missing speaker inputs", () => {
    const m = freshDemo();
    m.requirements.items = m.requirements.items.filter((r) => r.kind !== "speaker");
    const result = readMeetings(memoryStorage(JSON.stringify({ version: 1, meetings: [m] })));
    expect(result.warning).toBeNull();
    expect(result.meetings[0].requirements.items.some((r) => r.kind === "speaker")).toBe(false);
    expect(result.meetings[0].transcript.text).toBe(m.transcript.text);
    expect(result.meetings[0].analysis).toEqual(m.analysis);
  });
  it("rejects duplicated requirement IDs in storage", () => {
    const m = freshDemo();
    m.requirements.items.push(m.requirements.items[0]);
    expect(
      readMeetings(memoryStorage(JSON.stringify({ version: 2, meetings: [m] }))).warning,
    ).toBeTruthy();
  });
  it("retains temporarily blank action descriptions during editing", () => {
    const storage = memoryStorage();
    const m = freshDemo();
    m.actionItems[0].description = "";
    writeMeetings(storage, [m]);
    expect(readMeetings(storage).warning).toBeNull();
    expect(readMeetings(storage).meetings[0].actionItems[0].description).toBe("");
  });
  it("loads a pre-analyzed demo on first visit", () => {
    const result = readMeetings(memoryStorage());
    expect(result.meetings[0].analysis?.scenarioId).toBe("launch-incomplete");
  });
  it("round-trips requirements, analysis, exceptions, and summary", () => {
    const storage = memoryStorage();
    const meeting = endMeeting(prepareMeeting(freshDemo()), "Accepted by host");
    expect(writeMeetings(storage, [meeting])).toBeNull();
    expect(readMeetings(storage).meetings).toEqual([meeting]);
  });
  it.each(["not json", "{}"])("safely falls back for invalid data %s", (raw) => {
    const result = readMeetings(memoryStorage(raw));
    expect(result.warning).toBeTruthy();
    expect(result.meetings[0].id).toBe("demo-launch");
  });
  it("preserves an empty workspace after the last meeting is deleted", () => {
    const storage = memoryStorage();
    writeMeetings(storage, []);
    expect(readMeetings(storage)).toEqual({ meetings: [], warning: null });
  });
  it("handles denied storage reads and failed writes", () => {
    const denied = {
      getItem() {
        throw new Error("denied");
      },
      setItem() {
        throw new Error("quota");
      },
    };
    expect(readMeetings(denied).meetings).toHaveLength(3);
    expect(writeMeetings(denied, [freshDemo()])).toContain("could not be saved");
  });
});
