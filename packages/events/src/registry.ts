import { z } from "zod/v4";

const mode = z.enum(["production", "eval"]);
const attempt = z.number().int().positive();

/** Stable analytics contracts. Add a new name@version instead of changing a historical payload. */
export const registry = {
  "task.submitted@1": {
    name: "task.submitted",
    version: 1,
    subjectType: "run",
    description: "A run and its queue job were admitted atomically.",
    payload: z.strictObject({
      mode,
      provider: z.string().min(1),
      modelId: z.string().min(1),
      promptVersion: z.string().nullable(),
      experimentId: z.uuid().nullable(),
      caseId: z.uuid().nullable(),
    }),
  },
  "task.started@1": {
    name: "task.started",
    version: 1,
    subjectType: "run",
    description: "A worker acquired a new fenced execution attempt.",
    payload: z.strictObject({ mode, attempt }),
  },
  "task.retry_scheduled@1": {
    name: "task.retry_scheduled",
    version: 1,
    subjectType: "run",
    description:
      "An attempt failed and the run returned to queued state for retry.",
    payload: z.strictObject({ mode, attempt }),
  },
  "task.completed@1": {
    name: "task.completed",
    version: 1,
    subjectType: "run",
    description: "The final run result and optional eval score committed.",
    payload: z.strictObject({
      mode,
      attempt,
      evalPassed: z.boolean().nullable(),
    }),
  },
  "task.failed@1": {
    name: "task.failed",
    version: 1,
    subjectType: "run",
    description:
      "A run became terminally failed through execution or queue reconciliation.",
    payload: z.strictObject({
      mode,
      attempt: z.number().int().nonnegative(),
      reason: z.enum([
        "execution",
        "queue_missing",
        "queue_failed",
        "queue_cancelled",
        "queue_completed",
      ]),
    }),
  },
  "eval.case_created@1": {
    name: "eval.case_created",
    version: 1,
    subjectType: "eval_case",
    description: "A new immutable evaluation case was authored.",
    payload: z.strictObject({
      dataset: z.string().min(1).max(100),
      assertionCount: z.number().int().nonnegative(),
      hasJudge: z.boolean(),
      sourceRunId: z.uuid().nullable(),
    }),
  },
  "task.promoted_to_eval@1": {
    name: "task.promoted_to_eval",
    version: 1,
    subjectType: "run",
    description: "A source run was promoted to a new immutable eval case.",
    payload: z.strictObject({
      caseId: z.uuid(),
      dataset: z.string().min(1).max(100),
    }),
  },
  "experiment.launched@1": {
    name: "experiment.launched",
    version: 1,
    subjectType: "experiment",
    description:
      "An experiment and all of its trial runs/jobs were admitted atomically.",
    payload: z.strictObject({
      trialCount: z.number().int().positive(),
      caseCount: z.number().int().positive(),
    }),
  },
} as const;

type Registry = typeof registry;
export type EventInput = {
  [K in keyof Registry]: {
    name: Registry[K]["name"];
    version: Registry[K]["version"];
    subjectType: Registry[K]["subjectType"];
    subjectId: string;
    actorId: string | null;
    runId?: string | null;
    traceId?: string | null;
    idempotencyKey?: string | null;
    payload: z.input<Registry[K]["payload"]>;
  };
}[keyof Registry];
