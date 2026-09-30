import "server-only";

import { z } from "zod";

import type { AnalysisProvider } from "../analysis-provider";
import { AnalysisError, AnalysisInput } from "../analysis-contract";
import { MeetingAnalysis } from "../models";
import {
  EXTRACTION_SYSTEM_PROMPT,
  extractionSchema,
  normalizeExtraction,
} from "./extraction";

type ProviderConfig = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
};

export class DeepSeekAnalysisProvider
  implements AnalysisProvider<Promise<MeetingAnalysis>>
{
  constructor(
    private readonly config: ProviderConfig,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async analyze(input: AnalysisInput): Promise<MeetingAnalysis> {
    const apiKey = this.config.apiKey?.trim();

    if (!apiKey) {
      throw new AnalysisError("MISSING_API_KEY");
    }

    const baseUrl =
      this.config.baseUrl?.trim() || "https://api.deepseek.com";

    let endpoint: URL;

    try {
      endpoint = new URL(
        `${baseUrl.replace(/\/$/, "")}/chat/completions`,
      );

      if (endpoint.protocol !== "https:") {
        throw new Error("DeepSeek endpoint must use HTTPS");
      }
    } catch {
      console.error("[DeepSeek] Invalid API base URL");
      throw new AnalysisError("PROVIDER_ERROR");
    }

    const controller = new AbortController();

    const timer = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs ?? 60_000,
    );

    try {
      const response = await this.fetcher(endpoint, {
        method: "POST",
        signal: controller.signal,
        redirect: "error",
        cache: "no-store",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },

        body: JSON.stringify({
          model:
            this.config.model?.trim() ||
            "deepseek-flash",

          temperature: 0,

          max_tokens: 20000,

          response_format: {
            type: "json_object",
          },

          messages: [
            {
              role: "system",

              content: `
${EXTRACTION_SYSTEM_PROMPT}

IMPORTANT OUTPUT RULES:

- Return ONLY valid JSON.
- Do not use Markdown.
- Do not wrap the response in a code block.
- Do not include explanations before or after the JSON.
- Do not invent information that is not supported by the transcript.
- Use null / missing values when information is unavailable.
- The JSON must follow the schema below.

JSON schema:
${JSON.stringify(z.toJSONSchema(extractionSchema))}
              `.trim(),
            },

            {
              role: "user",

              content: JSON.stringify({
                template: input.templateId,

                context: input.context,

                requirements: input.requirements.items.map(
                  ({
                    id,
                    kind,
                    label,
                    topicId,
                    level,
                    requireOwner,
                    requireDeadline,
                  }) => ({
                    id,
                    kind,
                    label,
                    topicId,
                    level,
                    requireOwner,
                    requireDeadline,
                  }),
                ),

                transcript: input.transcript.text
                  .split(/\r?\n/)
                  .map((text, i) => ({
                    line: i + 1,
                    text,
                  })),
              }),
            },
          ],
        }),
      });

      if (!response.ok) {
        let providerBody = "";

        try {
          providerBody = await response.text();
        } catch {
          providerBody = "<unable to read response body>";
        }

        console.error("[DeepSeek] API request failed", {
          status: response.status,
          statusText: response.statusText,
          requestId:
            response.headers.get("x-request-id") ??
            response.headers.get("request-id") ??
            undefined,

          // Never log Authorization/API key.
          // Limit provider response to avoid huge logs.
          body: providerBody.slice(0, 1000),
        });

        throw new AnalysisError("PROVIDER_ERROR");
      }

      let responseBody: unknown;

      try {
        responseBody = await response.json();
      } catch (error) {
        console.error(
          "[DeepSeek] Response was not valid JSON",
          error instanceof Error ? error.message : error,
        );

        throw new AnalysisError("INVALID_OUTPUT");
      }

      /*
       * DeepSeek may return content = null / empty.
       * Do not assume content is always a string.
       */
      const envelope = z
        .object({
          choices: z
            .array(
              z.object({
                finish_reason: z.string().nullable().optional(),

                message: z.object({
                  content: z
                    .string()
                    .nullable()
                    .optional(),
                }),
              }),
            )
            .min(1),
        })
        .safeParse(responseBody);

      if (!envelope.success) {
        console.error(
          "[DeepSeek] Unexpected response envelope",
          envelope.error.flatten(),
        );

        throw new AnalysisError("INVALID_OUTPUT");
      }

      const choice = envelope.data.choices[0];

      if (choice.finish_reason !== "stop") {
        console.error(
          "[DeepSeek] Completion did not finish normally",
          {
            finishReason: choice.finish_reason,
          },
        );

        throw new AnalysisError("INVALID_OUTPUT");
      }

      const content = choice.message.content;

      if (!content?.trim()) {
        console.error(
          "[DeepSeek] Completion returned empty content",
        );

        throw new AnalysisError("INVALID_OUTPUT");
      }

      let value: unknown;

      try {
        value = JSON.parse(content);
      } catch {
        console.error(
          "[DeepSeek] Completion was not parseable JSON",
          {
            preview: content.slice(0, 1000),
          },
        );

        throw new AnalysisError("INVALID_OUTPUT");
      }

      try {
        return normalizeExtraction(value, input);
      } catch (error) {
        console.error(
          "[DeepSeek] Extracted JSON failed schema normalization",
          error instanceof Error
            ? error.message
            : error,
        );

        throw new AnalysisError("INVALID_OUTPUT");
      }
    } catch (error) {
      if (controller.signal.aborted) {
        console.error(
          "[DeepSeek] Request timed out",
        );

        throw new AnalysisError("TIMEOUT");
      }

      if (error instanceof AnalysisError) {
        throw error;
      }

      console.error(
        "[DeepSeek] Unexpected provider error",
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
            }
          : error,
      );

      throw new AnalysisError("PROVIDER_ERROR");
    } finally {
      clearTimeout(timer);
    }
  }
}

export function configuredAnalysisProvider(): AnalysisProvider<
  Promise<MeetingAnalysis>
> {
  return new DeepSeekAnalysisProvider({
    apiKey: process.env.DEEPSEEK_API_KEY,

    baseUrl:
      process.env.DEEPSEEK_BASE_URL ||
      "https://api.deepseek.com",

    model:
      process.env.DEEPSEEK_MODEL ||
      "deepseek-flash",

    timeoutMs: 60_000,
  });
}