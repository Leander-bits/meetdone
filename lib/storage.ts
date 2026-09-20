import { validRequirementLists } from "./requirements";
import { Meeting, meetingSchema } from "./models";
import { sampleMeetings } from "./sample-meetings";
export const STORAGE_KEY = "meetdone.workspace.v1";
export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function migrateMeeting(record: unknown): Meeting | null {
  if (!record || typeof record !== "object") return null;
  const raw = record as Record<string, unknown>;
  const legacy = !raw.structure;
  const requirements = raw.requirements as Meeting["requirements"] | undefined;
  const result = meetingSchema.safeParse(
    legacy
      ? {
          ...raw,
          date: "",
          startTime: "",
          endTime: "",
          timezone: "",
          participants: [],
          goals: Array.isArray(requirements?.items)
            ? requirements.items.filter((r) => r && r.kind === "goal")
            : [],
          structure: {
            type: "stages",
            segments: [],
            stages: [],
            speakerOrder: [],
            requiredSpeakerIds: [],
          },
          migrationNote: "Imported meeting. Date, time, and participants may need review.",
        }
      : raw,
  );
  if (!result.success) return null;
  const m = result.data;
  const wasDemoAnalysis = m.analysis?.provider === "demo";
  if (m.lifecycle === "active" && !validRequirementLists(m.requirements)) return null;
  const stale =
    m.analysis &&
    (m.analysis.transcriptRevision !== m.transcript.revision ||
      m.analysis.requirementsRevision !== m.requirements.revision);
  if (stale) {
    m.analysis = null;
    m.completionCheck = null;
  }
  if (m.completionCheck?.stateRevision !== m.stateRevision) m.completionCheck = null;
  if (m.lifecycle !== "active" && !m.summary) {
    m.lifecycle = "active";
    m.completionCheck = null;
  }
  // Archived summaries remain readable. Active mock results must be re-analyzed with AI.
  if (m.lifecycle === "active" && wasDemoAnalysis) {
    m.analysis = null;
    m.completionCheck = null;
    m.actionItems = m.actionItems
      .filter((a) => a.source === "host")
      .map((a) => ({ ...a, evidenceIds: [] }));
    m.gapResolutions = [];
    m.summary = null;
  }
  // Preserve original requirements, transcripts, and ended summaries; never claim that
  // synthetic migration defaults have been analyzed.
  return m;
}
export function readMeetings(storage: StorageLike): {
  meetings: Meeting[];
  warning: string | null;
} {
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { meetings: sampleMeetings(), warning: null };
    const data = JSON.parse(raw);
    if (![1, 2, 3].includes(data.version) || !Array.isArray(data.meetings)) throw new Error();
    const meetings: Meeting[] = [];
    let skipped = false;
    for (const record of data.meetings) {
      const m = migrateMeeting(record);
      if (m && !meetings.some((saved) => saved.id === m.id)) meetings.push(m);
      else skipped = true;
    }
    // Keep a recovery copy before any subsequent edits overwrite the workspace.
    if (
      skipped ||
      data.version < 3 ||
      data.meetings.some(
        (m: { analysis?: { provider?: string } }) => m?.analysis?.provider === "demo",
      )
    ) {
      try {
        if (!storage.getItem("meetdone.workspace.recovery"))
          storage.setItem("meetdone.workspace.recovery", raw);
      } catch {
        /* read remains usable */
      }
    }
    return {
      meetings,
      warning: skipped
        ? "Some saved records could not be opened. A recovery copy was kept where browser storage permits."
        : null,
    };
  } catch {
    try {
      if (raw && !storage.getItem("meetdone.workspace.recovery"))
        storage.setItem("meetdone.workspace.recovery", raw);
    } catch {
      /* storage unavailable */
    }
    return {
      meetings: sampleMeetings(),
      warning:
        "Saved data could not be read. A fresh demo is available; save a change to start a new local workspace.",
    };
  }
}
export function writeMeetings(storage: StorageLike, meetings: Meeting[]): string | null {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 3, meetings }));
    return null;
  } catch {
    return "Changes are available in this tab but could not be saved to this browser. Storage may be full or disabled.";
  }
}
