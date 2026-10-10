import { Agent } from "@strands-agents/sdk";
import { z } from "zod/v4";

import type { JudgeConfig } from "@multitudes/db/schema";
import { createModel } from "@multitudes/ai";

import { JUDGE_PROMPT, JUDGE_PROMPT_VERSION } from "./prompts/judge";

const verdictSchema = z
  .object({
    score: z.number().min(0).max(1),
    reason: z.string().min(1).max(2000),
  })
  .strict();
/** Fail closed on invalid judge output: a parse failure is an execution failure, never a pass. */
export function parseVerdict(text: string, config: JudgeConfig) {
  const verdict = verdictSchema.parse(JSON.parse(text));
  return {
    ...verdict,
    passed: verdict.score >= config.threshold,
    promptVersion: config.promptVersion,
  };
}

/** The same metered provider as production, with no tools and a separate judge cost category. */
export async function judgeOutput(options: {
  runId: string;
  attempt: number;
  input: string;
  output: string;
  config: JudgeConfig;
  signal: AbortSignal;
}) {
  if (options.config.promptVersion !== JUDGE_PROMPT_VERSION)
    throw new Error("Judge prompt version does not match this worker");
  const agent = new Agent({
    model: createModel(options.config, {
      runId: options.runId,
      attempt: options.attempt,
      purpose: "judge",
    }),
    systemPrompt: JUDGE_PROMPT,
    tools: [],
    printer: false,
  });
  try {
    const result = await agent.invoke(
      JSON.stringify({
        rubric: options.config.rubric,
        task: options.input,
        candidate: options.output,
      }),
      {
        cancelSignal: options.signal,
        limits: { turns: 1, totalTokens: 50_000 },
      },
    );
    if (!["endTurn", "stopSequence"].includes(result.stopReason))
      throw new Error("Judge did not complete");
    const text = result.lastMessage.content
      .filter((block) => block.type === "textBlock")
      .map((block) => block.text)
      .join("");
    return parseVerdict(text, options.config);
  } finally {
    await agent.shutdown();
  }
}
