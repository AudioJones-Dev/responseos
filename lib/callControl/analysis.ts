import type { Prisma } from "@prisma/client";
import { z } from "zod";

export const POST_CALL_ANALYSIS_SCHEMA_VERSION = "frl-post-call.v1";
export const POST_CALL_ANALYSIS_PROMPT_VERSION = "frl-vpl-intake.v1";

export const PostCallStructuredResultSchema = z.strictObject({
  summary: z.string().trim().min(1).max(2_000),
  qualification: z.strictObject({ status: z.enum(["qualified", "maybe", "unqualified", "spam"]) }),
  next_action: z.string().trim().min(1).max(1_000),
});

export interface PostCallAnalysisResult {
  provider: string;
  model: string;
  result: z.infer<typeof PostCallStructuredResultSchema>;
  completeness: "complete" | "partial" | "unavailable";
  uncertainty: string[];
}

export interface PostCallAnalysisAdapter {
  analyze(input: { transcript: string }): Promise<PostCallAnalysisResult>;
}

export const conservativePostCallAnalysis: PostCallAnalysisAdapter = {
  async analyze() {
    return {
      provider: "responseos",
      model: "deterministic-review-required.v1",
      result: PostCallStructuredResultSchema.parse({
        summary: "Analysis unavailable — review the frozen transcript.",
        qualification: { status: "maybe" },
        next_action: "Human review required.",
      }),
      completeness: "unavailable",
      uncertainty: ["No approved post-call model provider is configured."],
    };
  },
};

export function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
