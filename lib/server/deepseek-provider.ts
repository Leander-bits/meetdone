import "server-only";
import { z } from "zod";
import type { AnalysisProvider } from "../analysis-provider";
import { AnalysisError, AnalysisInput } from "../analysis-contract";
import { MeetingAnalysis } from "../models";
import { EXTRACTION_SYSTEM_PROMPT, extractionSchema, normalizeExtraction } from "./extraction";

type ProviderConfig = { apiKey?: string; baseUrl?: string; model?: string; timeoutMs?: number };
export class DeepSeekAnalysisProvider implements AnalysisProvider<Promise<MeetingAnalysis>> {
  constructor(
    private readonly config: ProviderConfig,
    private readonly fetcher: typeof fetch = fetch,
  ) {}
  async analyze(input: AnalysisInput): Promise<MeetingAnalysis> {
    if (!this.config.apiKey?.trim()) throw new AnalysisError("MISSING_API_KEY");
    const baseUrl = this.config.baseUrl || "https://api.deepseek.com";
    let endpoint: URL;
    try {
      endpoint = new URL(`${baseUrl.replace(/\/$/, "")}/chat/completions`);
      if (endpoint.protocol !== "https:") throw new Error();
    } catch {
      throw new AnalysisError("PROVIDER_ERROR");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 45_000);
    try {
      const response = await this.fetcher(endpoint, {
        method: "POST",
        signal: controller.signal,
        redirect: "error",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model || "deepseek-chat",
          temperature: 0,
          max_tokens: 8000,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `${EXTRACTION_SYSTEM_PROMPT}\nJSON schema: ${JSON.stringify(z.toJSONSchema(extractionSchema))}`,
            },
            {
              role: "user",
              content: JSON.stringify({
                template: input.templateId,
                requirements: input.requirements.items.map(({ id, kind, label, topicId }) => ({
                  id,
                  kind,
                  label,
                  topicId,
                })),
                transcript: input.transcript.text
                  .split(/\r?\n/)
                  .map((text, i) => ({ line: i + 1, text })),
              }),
            },
          ],
        }),
      });
      if (!response.ok) throw new AnalysisError("PROVIDER_ERROR");
      let responseBody: unknown;
      try {
        responseBody = await response.json();
      } catch {
        throw new AnalysisError("INVALID_OUTPUT");
      }
      const envelope = z
        .object({
          choices: z
            .array(
              z.object({ finish_reason: z.string(), message: z.object({ content: z.string() }) }),
            )
            .min(1),
        })
        .safeParse(responseBody);
      if (!envelope.success || envelope.data.choices[0].finish_reason !== "stop")
        throw new AnalysisError("INVALID_OUTPUT");
      let value: unknown;
      try {
        value = JSON.parse(envelope.data.choices[0].message.content);
      } catch {
        throw new AnalysisError("INVALID_OUTPUT");
      }
      return normalizeExtraction(value, input);
    } catch (error) {
      if (controller.signal.aborted) throw new AnalysisError("TIMEOUT");
      if (error instanceof AnalysisError) throw error;
      throw new AnalysisError("PROVIDER_ERROR");
    } finally {
      clearTimeout(timer);
    }
  }
}
export function configuredAnalysisProvider(): AnalysisProvider<Promise<MeetingAnalysis>> {
  return new DeepSeekAnalysisProvider({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseUrl: process.env.DEEPSEEK_BASE_URL,
    model: process.env.DEEPSEEK_MODEL,
  });
}
