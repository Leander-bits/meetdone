import { z } from "zod";

export const requirementKinds = [
  "goal",
  "conclusion",
  "topic",
  "speaker",
  "decision",
  "action",
  "agenda",
] as const;
export const requirementSchema = z.object({
  id: z.string(),
  kind: z.enum(requirementKinds),
  label: z.string().min(1),
  level: z.enum(["required", "recommended", "record_only"]),
  allowsDeferral: z.boolean(),
  topicId: z.string().optional(),
  builtinKey: z.string().optional(),
});
export const requirementsSchema = z.object({
  revision: z.number().int().positive(),
  items: z.array(requirementSchema),
});
export const templateSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string(),
  description: z.string(),
  defaultTitle: z.string(),
  requirements: requirementsSchema,
});
export const evidenceSchema = z.object({
  id: z.string(),
  transcriptRevision: z.number(),
  segmentId: z.string(),
  speaker: z.string(),
  quote: z.string(),
});
const findingBase = {
  requirementId: z.string(),
  requirementKey: z.string(),
  evidenceIds: z.array(z.string()),
};
export const actionSchema = z.object({
  id: z.string(),
  requirementId: z.string().optional(),
  description: z.string(),
  owner: z.string().nullable(),
  deadline: z.string().nullable(),
  status: z.enum(["open", "in_progress", "done", "unknown"]),
  source: z.enum(["demo", "ai", "host"]),
  gapId: z.string().optional(),
  evidenceIds: z.array(z.string()),
});
export const analysisSchema = z.object({
  id: z.string(),
  provider: z.enum(["demo", "deepseek"]),
  scenarioId: z.string().nullable(),
  transcriptRevision: z.number(),
  requirementsRevision: z.number(),
  goals: z.array(
    z.object({
      ...findingBase,
      status: z.enum(["complete", "partial", "missing"]),
      detail: z.string(),
    }),
  ),
  conclusions: z.array(
    z.object({
      ...findingBase,
      status: z.enum(["complete", "partial", "missing"]),
      detail: z.string(),
    }),
  ),
  topics: z.array(
    z.object({
      ...findingBase,
      status: z.enum(["complete", "partial", "missing"]),
      detail: z.string(),
    }),
  ),
  speakers: z.array(
    z.object({
      ...findingBase,
      status: z.enum(["opinion", "mentioned", "missing"]),
      classification: z
        .enum(["not_mentioned", "present_no_opinion", "expressed_opinion"])
        .optional(),
      detail: z.string(),
    }),
  ),
  decisions: z.array(
    z.object({
      ...findingBase,
      status: z.enum(["decided", "discussed", "missing"]),
      classification: z.enum(["not_discussed", "discussed_not_decided", "decided"]).optional(),
      outcome: z.string().nullable().optional(),
      detail: z.string(),
    }),
  ),
  actionItems: z.array(actionSchema),
  unresolvedIssues: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      blocking: z.boolean(),
      requirementId: z.string().optional(),
      evidenceIds: z.array(z.string()),
    }),
  ),
  evidence: z.array(evidenceSchema),
});
export const gapSchema = z.object({
  id: z.string(),
  type: z.enum([
    "analysis_missing",
    "goal_uncovered",
    "conclusion_missing",
    "topic_uncovered",
    "speaker_missing",
    "decision_missing",
    "decision_pending",
    "action_missing",
    "action_owner",
    "action_deadline",
    "unresolved_issue",
  ]),
  severity: z.enum(["BLOCKING", "FOLLOW_UP"]),
  requirementId: z.string().optional(),
  title: z.string(),
  explanation: z.string(),
  nextAction: z.string(),
  evidenceIds: z.array(z.string()),
  allowsDeferral: z.boolean(),
});
export const completionSchema = z.object({
  readiness: z.enum(["READY", "BLOCKED"]),
  requirementsRevision: z.number(),
  transcriptRevision: z.number(),
  stateRevision: z.number(),
  blockingGaps: z.array(gapSchema),
  followUpGaps: z.array(gapSchema),
  deferredGapIds: z.array(z.string()),
});
export const resolutionSchema = z.object({
  id: z.string(),
  gapId: z.string(),
  type: z.enum(["action", "exception"]),
  actionItemId: z.string().optional(),
  reason: z.string().optional(),
  createdAt: z.string(),
});
export const lifecycleSchema = z.enum(["active", "ended", "ended_with_exceptions"]);
export const summarySchema = z.object({
  originalGoal: z.string(),
  goalsAchieved: z.array(z.string()),
  conclusions: z.array(z.string()),
  decisions: z.array(z.string()),
  unresolvedIssues: z.array(z.string()),
  actionItems: z.array(actionSchema),
  remainingRisks: z.array(z.string()),
  acceptedExceptions: z.array(z.object({ gap: z.string(), reason: z.string() })),
  lifecycle: lifecycleSchema,
  readiness: z.enum(["READY", "BLOCKED"]),
  endedAt: z.string(),
  analysisId: z.string(),
});
export const meetingSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  builtinTitle: z.boolean().optional(),
  templateId: z.string().min(1).max(100),
  isDemo: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lifecycle: lifecycleSchema,
  stateRevision: z.number().int().positive(),
  requirements: requirementsSchema,
  transcript: z.object({
    text: z.string(),
    revision: z.number().int().positive(),
    scenarioId: z.string().nullable(),
    fileName: z.string().optional(),
  }),
  analysis: analysisSchema.nullable(),
  actionItems: z.array(actionSchema),
  gapResolutions: z.array(resolutionSchema),
  completionCheck: completionSchema.nullable(),
  summary: summarySchema.nullable(),
});
export type Requirement = z.infer<typeof requirementSchema>;
export type MeetingRequirements = z.infer<typeof requirementsSchema>;
export type MeetingTemplate = z.infer<typeof templateSchema>;
export type MeetingAnalysis = z.infer<typeof analysisSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type ActionItem = z.infer<typeof actionSchema>;
export type Gap = z.infer<typeof gapSchema>;
export type CompletionCheck = z.infer<typeof completionSchema>;
export type GapResolution = z.infer<typeof resolutionSchema>;
export type MeetingSummary = z.infer<typeof summarySchema>;
export type Meeting = z.infer<typeof meetingSchema>;

// Labels and topic relationships identify meaning. Changing priority does not invent new evidence.
export function requirementKey(r: Requirement, items: Requirement[] = []): string {
  return JSON.stringify([
    r.kind,
    r.label.trim(),
    r.topicId ?? "",
    r.topicId ? (items.find((item) => item.id === r.topicId)?.label.trim() ?? "") : "",
  ]);
}
export const kindLabels: Record<Requirement["kind"], string> = {
  goal: "Goals",
  conclusion: "Required conclusions",
  topic: "Topics",
  speaker: "Speaker inputs",
  decision: "Decisions",
  action: "Action outputs",
  agenda: "Agenda",
};
