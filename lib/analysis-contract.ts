import { z } from "zod";
import { requirementsSchema } from "./models";
import { validRequirementLists } from "./requirements";

export const MIN_TRANSCRIPT_LENGTH = 30;
export const MAX_TRANSCRIPT_LENGTH = 30_000;
export const MAX_REQUEST_BYTES = 180_000;
export const analysisRequestSchema = z
  .object({
    templateId: z.enum(["launch", "retro", "customer"]),
    requirements: requirementsSchema.refine(validRequirementLists),
    transcript: z.object({
      text: z.string().max(MAX_TRANSCRIPT_LENGTH),
      revision: z.number().int().positive(),
      scenarioId: z.string().nullable(),
    }),
  })
  .strict();
export type AnalysisInput = z.infer<typeof analysisRequestSchema>;
export type AnalysisErrorCode =
  | "EMPTY_TRANSCRIPT"
  | "TRANSCRIPT_TOO_SHORT"
  | "TRANSCRIPT_TOO_LONG"
  | "INVALID_REQUEST"
  | "MISSING_API_KEY"
  | "TIMEOUT"
  | "PROVIDER_ERROR"
  | "INVALID_OUTPUT"
  | "STALE_ANALYSIS";
export class AnalysisError extends Error {
  constructor(public readonly code: AnalysisErrorCode) {
    super(code);
    this.name = "AnalysisError";
  }
}
export function transcriptError(text: string): AnalysisErrorCode | null {
  if (!text.trim()) return "EMPTY_TRANSCRIPT";
  if (text.trim().length < MIN_TRANSCRIPT_LENGTH) return "TRANSCRIPT_TOO_SHORT";
  if (text.length > MAX_TRANSCRIPT_LENGTH) return "TRANSCRIPT_TOO_LONG";
  return null;
}
