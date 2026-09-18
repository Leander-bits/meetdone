import { z } from "zod";
import { Meeting, meetingSchema } from "./models";
import { freshDemo } from "./meeting-state";
import { getTemplate } from "./templates";
import { minimumKinds, validRequirementLists } from "./requirements";

export const STORAGE_KEY = "meetdone.workspace.v1";
const storeSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  meetings: z.array(meetingSchema).min(1),
});
export type StorageLike = Pick<Storage, "getItem" | "setItem">;
export function readMeetings(storage: StorageLike): {
  meetings: Meeting[];
  warning: string | null;
} {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { meetings: [freshDemo()], warning: null };
    const parsed = storeSchema.safeParse(JSON.parse(raw));
    if (
      !parsed.success ||
      new Set(parsed.data.meetings.map((m) => m.id)).size !== parsed.data.meetings.length
    )
      throw new Error("Invalid saved workspace");
    const meetings = parsed.data.meetings.map((m) => {
      const template = getTemplate(m.templateId);
      // Repair Phase 1 lists that could be emptied. Preserve all existing user content.
      const missingKinds = minimumKinds.filter(
        (kind) => !m.requirements.items.some((r) => r.kind === kind),
      );
      if (missingKinds.length && m.lifecycle === "active") {
        m.requirements = {
          revision: m.requirements.revision + 1,
          items: [
            ...m.requirements.items,
            ...missingKinds.map((kind) => ({
              ...template.requirements.items.find((r) => r.kind === kind)!,
              id: `restored-${kind}`,
              topicId: undefined,
            })),
          ],
        };
        m.analysis = null;
        m.completionCheck = null;
      }
      if (m.lifecycle === "active" && !validRequirementLists(m.requirements))
        throw new Error("Invalid requirement lists");
      if (parsed.data.version === 1 && m.isDemo) {
        m.builtinTitle = m.title === template.defaultTitle;
        m.requirements.items = m.requirements.items.map((r) => ({
          ...r,
          builtinKey: template.requirements.items.find(
            (defaultR) => defaultR.id === r.id && defaultR.label === r.label,
          )?.label,
        }));
      }
      const stale =
        m.analysis &&
        (m.analysis.transcriptRevision !== m.transcript.revision ||
          m.analysis.requirementsRevision !== m.requirements.revision);
      if (m.lifecycle !== "active" && !m.summary) throw new Error("Invalid ended meeting");
      return {
        ...m,
        analysis: stale ? null : m.analysis,
        completionCheck:
          stale || m.completionCheck?.stateRevision !== m.stateRevision ? null : m.completionCheck,
      };
    });
    return { meetings, warning: null };
  } catch {
    return {
      meetings: [freshDemo()],
      warning:
        "Saved data could not be read. A fresh demo is available; save a change to start a new local workspace.",
    };
  }
}
export function writeMeetings(storage: StorageLike, meetings: Meeting[]): string | null {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, meetings }));
    return null;
  } catch {
    return "Changes are available in this tab but could not be saved to this browser. Storage may be full or disabled.";
  }
}
