import { randomUUID } from "node:crypto";
import { z } from "zod/v4";

import type { AgentConfiguration, EvalAssertion } from "@multitudes/db/schema";
import { configurationSchema, inputSchema } from "@multitudes/agent";
import { createCase, enqueueRuns, getCase, getRun } from "@multitudes/db/runs";
import { captureTraceContext } from "@multitudes/observability/context";

export const caseSchema = z.object({
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
    .min(1)
    .max(50),
  sourceRunId: z.uuid().optional(),
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
export async function authorCase(input: unknown) {
  const value = caseSchema.parse(input);
  if (value.sourceRunId && !(await getRun(value.sourceRunId)))
    throw new Error("Source run does not exist");
  return createCase(value);
}

/** Freeze a configuration and enqueue every trial atomically with its experiment. */
export async function launchExperiment(input: {
  name: string;
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
          traceContext,
          experimentId: id,
          caseId: item.id,
        }))
      : [],
  );
  await enqueueRuns(runs, { id, name, configuration });
  return id;
}
