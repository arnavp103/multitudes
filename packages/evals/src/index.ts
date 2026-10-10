import { createHash, randomUUID } from "node:crypto";
import { z } from "zod/v4";

import type { AgentConfiguration, EvalAssertion } from "@multitudes/db/schema";
import { configurationSchema, inputSchema } from "@multitudes/agent";
import { taskFixturesSchema } from "@multitudes/db/agent-service";
import { createCase, enqueueRuns, getCase, getRun } from "@multitudes/db/runs";
import { captureTraceContext } from "@multitudes/observability/context";
import { createLogger } from "@multitudes/observability/logger";

import { JUDGE_PROMPT_VERSION, JUDGE_PROMPTS } from "./prompts/judge";

const logger = createLogger("multitudes-evals");

export const judgeSchema = z.object({
  provider: z.literal("gemini"),
  modelId: z.string().min(1).max(256),
  rubric: z.string().min(1).max(8000),
  threshold: z.number().min(0).max(1).default(0.8),
  promptVersion: z
    .string()
    .refine(
      (version) => Object.hasOwn(JUDGE_PROMPTS, version),
      "Unknown judge prompt version",
    )
    .default(JUDGE_PROMPT_VERSION),
});

export const caseSchema = z
  .object({
    name: z.string().min(1).max(200),
    dataset: z.string().min(1).max(100),
    input: inputSchema,
    assertions: z
      .array(
        z.object({
          kind: z.enum(["contains", "not_contains"]),
          value: z.string().min(1).max(4_000),
        }),
      )
      .max(50),
    sourceRunId: z.uuid().optional(),
    toolFixtures: taskFixturesSchema.default({}),
    judge: judgeSchema.optional(),
  })
  .refine((value) => value.assertions.length > 0 || !!value.judge, {
    message: "Add an assertion or a judge rubric",
  });

/** Versioned deterministic grader; matching is intentionally case-sensitive. */
export function gradeOutput(output: string, assertions: EvalAssertion[]) {
  if (!assertions.length)
    throw new Error("An eval requires at least one assertion");
  const details = assertions.map((assertion) => ({
    assertion,
    passed:
      assertion.kind === "contains"
        ? output.includes(assertion.value)
        : !output.includes(assertion.value),
  }));
  return {
    passed: details.every((item) => item.passed),
    details,
    evaluatorVersion: "text-assertions/v1",
  };
}

/** Save a new immutable case; edits are new case IDs, preserving old experiments. */
export async function authorCase(input: unknown, actorId: string) {
  const value = caseSchema.parse(input);
  if (value.sourceRunId && !(await getRun(value.sourceRunId)))
    throw new Error("Source run does not exist");
  const result = await createCase(value, z.string().min(1).parse(actorId));
  logger.info(
    { case_id: result.id, assertion_count: value.assertions.length },
    "Eval case authored",
  );
  return result;
}

/** Freeze a configuration and enqueue every trial atomically with its experiment. */
export async function launchExperiment(input: {
  name: string;
  ownerId: string;
  requestKey: string;
  caseIds: string[];
  configuration: AgentConfiguration;
  repetitions?: number;
}) {
  const name = z.string().min(1).max(200).parse(input.name);
  const caseIds = z.array(z.uuid()).min(1).max(100).parse(input.caseIds);
  const repetitions = z
    .number()
    .int()
    .min(1)
    .max(5)
    .parse(input.repetitions ?? 1);
  const configuration = configurationSchema.parse(input.configuration);
  const cases = await Promise.all([...new Set(caseIds)].map(getCase));
  if (cases.some((item) => !item))
    throw new Error("An eval case no longer exists");
  const id = randomUUID();
  const traceContext = captureTraceContext();
  const runs = cases.flatMap((item) =>
    item
      ? Array.from({ length: repetitions }, () => ({
          input: item.input,
          configuration,
          mode: "eval" as const,
          ownerId: input.ownerId,
          traceContext,
          experimentId: id,
          caseId: item.id,
        }))
      : [],
  );
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        operation: "experiment",
        name,
        caseIds: [...new Set(caseIds)].sort(),
        repetitions,
        configuration,
      }),
    )
    .digest("hex");
  const ids = await enqueueRuns(
    runs,
    { id, name, configuration },
    {
      ownerId: z.string().min(1).parse(input.ownerId),
      key: z.uuid().parse(input.requestKey),
      fingerprint,
    },
  );
  const experimentId = ids[0]
    ? (await getRun(ids[0]))?.experimentId
    : undefined;
  if (!experimentId) throw new Error("Experiment was not created");
  logger.info(
    { experiment_id: id, trial_count: runs.length },
    "Experiment launched",
  );
  return experimentId;
}

export { judgeOutput, parseVerdict } from "./judge";
