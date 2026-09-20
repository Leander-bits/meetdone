import {
  Meeting,
  MeetingRequirements,
  MeetingStructure,
  MeetingTemplate,
  Participant,
  Requirement,
  StructureType,
} from "./models";
import { validRequirementLists } from "./requirements";

export const structureNames: Record<StructureType, string> = {
  time: "Time Sequence",
  speaker: "Speaker Sequence",
  stages: "Stage Progression",
  matrix: "Stage × Speaker Matrix",
};
export function roleIsRequired(
  template: MeetingTemplate | undefined,
  role: Participant["role"],
  stageId?: string,
) {
  return (
    template?.roleRequirements.find((r) => r.role === role && r.stageId === stageId)?.required ??
    template?.roleRequirements.find((r) => r.role === role && !r.stageId)?.required ??
    true
  );
}
export function displayNameFromEmail(email: string) {
  return email.trim().split("@")[0];
}
// Match the selected local wall time, including daylight-saving transitions.
// Repeated times expose both offsets; nonexistent local times have no offset.
export function timezoneOffset(timezone: string, date: string, time = "12:00") {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return "";
    const wall = Date.parse(`${date}T${time}:00Z`);
    if (!Number.isFinite(wall)) return "";
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      timeZoneName: "longOffset",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const offsets = new Set(
      [-24, 0, 24].map(
        (hours) =>
          formatter
            .formatToParts(new Date(wall + hours * 3600000))
            .find((p) => p.type === "timeZoneName")!.value,
      ),
    );
    return [...offsets]
      .filter((offset) => {
        const match = offset.match(/^GMT([+-])(\d{2}):(\d{2})$/);
        const minutes = match
          ? (Number(match[2]) * 60 + Number(match[3])) * (match[1] === "+" ? 1 : -1)
          : 0;
        const parts = Object.fromEntries(
          formatter.formatToParts(new Date(wall - minutes * 60000)).map((p) => [p.type, p.value]),
        );
        return (
          `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}` ===
          `${date}T${time}`
        );
      })
      .map((offset) => offset.replace(/^GMT(?:[+-]00:00)?$/, "UTC").replace("GMT", "UTC"))
      .join(" / ");
  } catch {
    return "";
  }
}
export function scheduleText(
  m: Pick<Meeting, "date" | "startTime" | "endTime" | "timezone">,
): string | null {
  if (!m.date || !m.startTime || !m.endTime || !m.timezone) return null;
  const offset = timezoneOffset(m.timezone, m.date, m.startTime);
  const endOffset = timezoneOffset(m.timezone, m.date, m.endTime);
  const offsets = offset === endOffset ? offset : `${offset} \u2192 ${endOffset}`;
  return `${m.date} ${m.startTime}\u2013${m.endTime} \u00b7 ${m.timezone}${offsets ? ` (${offsets})` : ""}`;
}
export function durationMinutes(start: string, end: string) {
  const minutes = (value: string) =>
    /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
      ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
      : NaN;
  return minutes(end) - minutes(start);
}
export function validSchedule(date: string, start: string, end: string, timezone: string) {
  const duration = durationMinutes(start, end);
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    return false;
  }
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date &&
    duration >= 5 &&
    duration <= 720 &&
    duration % 5 === 0
  );
}
export function validParticipants(people: Participant[]) {
  return (
    people.length > 0 &&
    people.length <= 30 &&
    new Set(people.map((p) => p.id)).size === people.length &&
    new Set(people.map((p) => p.email.toLowerCase())).size === people.length &&
    people.every((p) => p.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))
  );
}
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
export function initialStructure(
  type: StructureType,
  duration: number,
  participants: Participant[],
  template?: MeetingTemplate,
): MeetingStructure {
  const units = Math.max(1, Math.floor(duration / 5));
  const defaults = (names: string[], prefix: string) =>
    names.map((name, i) => ({
      id: `${prefix}-${i}`,
      name,
      builtinKey: name,
      custom: false,
      goals: [{ id: `${prefix}-goal-${i}`, text: "" }],
    }));
  const timeDefaults =
    template?.structureType === "time" && template.defaultStages.length
      ? structuredClone(template.defaultStages)
      : defaults(["Opening", "Background", "Discussion", "Decision", "Action Items"], "segment");
  const segments = timeDefaults.slice(0, units);
  const stages =
    template && template.structureType !== "time" && template.defaultStages.length
      ? structuredClone(template.defaultStages)
      : defaults(["Background", "Proposal", "Risks", "Decision", "Next Steps"], "stage");
  return {
    type,
    segments: segments.map((segment, i) => ({
      ...segment,
      minutes: (Math.floor(units / segments.length) + (i < units % segments.length ? 1 : 0)) * 5,
    })),
    stages: stages.map((s) => ({ ...s, assignments: [] })),
    speakerOrder: participants.map((p) => p.id),
    requiredSpeakerIds: participants
      .filter((p) => roleIsRequired(template, p.role))
      .map((p) => p.id),
  };
}
// A resize borrows time from neighbouring segments; there is never unassigned time.
export function resizeSegment(segments: MeetingStructure["segments"], id: string, minutes: number) {
  const index = segments.findIndex((s) => s.id === id);
  if (index < 0 || !Number.isFinite(minutes)) return segments;
  const total = segments.reduce((sum, s) => sum + s.minutes, 0);
  const target = Math.max(
    5,
    Math.min(total - (segments.length - 1) * 5, Math.round(minutes / 5) * 5),
  );
  const next = structuredClone(segments);
  let delta = target - next[index].minutes;
  if (next.length === 1) return segments;
  if (delta < 0) {
    next[(index + 1) % next.length].minutes -= delta;
  } else
    for (let offset = 1; offset < next.length && delta > 0; offset++) {
      const other = next[(index + offset) % next.length];
      const take = Math.min(delta, other.minutes - 5);
      other.minutes -= take;
      delta -= take;
    }
  next[index].minutes = target;
  return next;
}
export function addSegment(segments: MeetingStructure["segments"], name: string, id: string) {
  const donor = segments.findIndex((s) => s.minutes >= 10);
  if (donor < 0) return segments;
  return [
    ...segments.map((s, i) => (i === donor ? { ...s, minutes: s.minutes - 5 } : s)),
    { id, name, custom: true, goals: [{ id: `${id}-goal`, text: "" }], minutes: 5 },
  ];
}
export function validStructure(s: MeetingStructure, duration: number, people: Participant[]) {
  const ids = new Set(people.map((p) => p.id));
  const unique = (values: string[]) => new Set(values).size === values.length;
  const stageValid = (stage: MeetingStructure["stages"][number]) =>
    stage.name.trim() &&
    stage.goals.length > 0 &&
    unique(stage.goals.map((g) => g.id)) &&
    unique(stage.assignments.map((a) => a.participantId)) &&
    stage.assignments.every((a) => ids.has(a.participantId));
  if (s.type === "time")
    return (
      s.segments.length > 0 &&
      unique(s.segments.map((x) => x.id)) &&
      s.segments.every(
        (x) => x.name.trim() && x.goals.length && x.minutes >= 5 && x.minutes % 5 === 0,
      ) &&
      s.segments.reduce((sum, x) => sum + x.minutes, 0) === duration
    );
  if (s.type === "speaker")
    return (
      s.speakerOrder.length === people.length &&
      unique(s.speakerOrder) &&
      s.speakerOrder.every((id) => ids.has(id)) &&
      unique(s.requiredSpeakerIds) &&
      s.requiredSpeakerIds.every((id) => ids.has(id))
    );
  return (
    s.stages.length > 0 &&
    unique(s.stages.map((x) => x.id)) &&
    s.stages.every(stageValid) &&
    (s.type !== "matrix" || s.stages.every((stage) => stage.assignments.length > 0))
  );
}
export function compileRequirements(
  goals: Requirement[],
  structure: MeetingStructure,
  participants: Participant[],
  rules: Requirement[],
): MeetingRequirements {
  const req = (
    id: string,
    kind: Requirement["kind"],
    label: string,
    extra: Partial<Requirement> = {},
  ): Requirement => ({ id, kind, label, level: "required", allowsDeferral: false, ...extra });
  const items = [...goals, ...rules.filter((r) => r.kind !== "goal")];
  const addSpeaker = (id: string, required: boolean, topicId?: string) => {
    const p = participants.find((p) => p.id === id);
    if (!p) return;
    items.push(
      req(`speaker-${topicId ?? "all"}-${id}`, "speaker", `${p.name}（${p.roleLabel ?? p.role}）`, {
        level: required ? "required" : "record_only",
        topicId,
        builtinKey: p.roleLabel ? undefined : `${p.name}（${p.role}）`,
      }),
    );
  };
  if (structure.type === "speaker")
    structure.speakerOrder.forEach((id) =>
      addSpeaker(id, structure.requiredSpeakerIds.includes(id)),
    );
  if (structure.type === "time" || structure.type === "stages" || structure.type === "matrix") {
    const stages = structure.type === "time" ? structure.segments : structure.stages;
    stages.forEach((stage) => {
      const topicId = `structure-${stage.id}`;
      // Timeline labels and empty stages guide the meeting; explicit goals are recommended.
      items.push(
        req(topicId, "topic", stage.name, {
          level: structure.type !== "time" ? "required" : "record_only",
          builtinKey: stage.builtinKey,
        }),
      );
      stage.goals
        .filter((g) => g.text.trim())
        .forEach((g) =>
          items.push(
            req(`structure-goal-${g.id}`, "topic", `${stage.name}: ${g.text}`, {
              level: "recommended",
              allowsDeferral: true,
            }),
          ),
        );
      if (structure.type === "matrix" && "assignments" in stage)
        stage.assignments.forEach((a) => addSpeaker(a.participantId, a.required, topicId));
    });
  }
  return { revision: 1, items: structuredClone(items) };
}
export function validConfiguration(
  goals: Requirement[],
  s: MeetingStructure,
  people: Participant[],
  duration: number,
  rules: Requirement[],
) {
  return (
    goals.length >= 1 &&
    goals.every((g) => g.label.trim()) &&
    validStructure(s, duration, people) &&
    validRequirementLists(compileRequirements(goals, s, people, rules))
  );
}
export function reusableTemplate(
  id: string,
  name: string,
  m: Pick<Meeting, "goals" | "structure" | "requirements" | "participants">,
): MeetingTemplate {
  return {
    id,
    name,
    structureType: m.structure.type,
    defaultGoals: structuredClone(m.goals),
    defaultStages: (m.structure.type === "time" ? m.structure.segments : m.structure.stages).map(
      ({ id, name, goals, custom, builtinKey }) => ({ id, name, goals, custom, builtinKey }),
    ),
    roleRequirements:
      m.structure.type === "matrix"
        ? m.structure.stages.flatMap((stage) =>
            [
              ...new Set(
                stage.assignments
                  .map((a) => m.participants.find((p) => p.id === a.participantId)?.role)
                  .filter((r): r is Participant["role"] => !!r),
              ),
            ].map((role) => ({
              id: `role-${stage.id}-${role}`,
              role,
              stageId: stage.id,
              required: stage.assignments.some(
                (a) =>
                  a.required && m.participants.find((p) => p.id === a.participantId)?.role === role,
              ),
            })),
          )
        : [...new Set(m.participants.map((p) => p.role))].map((role) => ({
            id: `role-${role}`,
            role,
            required:
              m.structure.type !== "speaker" ||
              m.participants.some(
                (p) => p.role === role && m.structure.requiredSpeakerIds.includes(p.id),
              ),
          })),
    rules: m.requirements.items
      .filter((r) => !["goal", "speaker"].includes(r.kind) && !r.id.startsWith("structure-"))
      .map((r) => ({ ...r, topicId: undefined })),
  };
}
