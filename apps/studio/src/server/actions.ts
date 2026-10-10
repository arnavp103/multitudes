"use server";

import { redirect } from "next/navigation";
import { z } from "zod/v4";

import { submitRun } from "@multitudes/agent";
import { authorCase, launchExperiment } from "@multitudes/evals";
import { withSpan } from "@multitudes/observability/context";
import { createLogger } from "@multitudes/observability/logger";

import { readStudioEnv } from "~/env";
import { requireStaff } from "./access";

const providerSchema = z.literal("gemini");

const logger = createLogger("multitudes-studio");

function field(form: FormData, name: string) {
  const value = form.get(name);
  if (typeof value !== "string") throw new Error(`Missing text field: ${name}`);
  return value;
}

function configuration(form: FormData) {
  return {
    provider: providerSchema.parse(form.get("provider")),
    modelId: field(form, "modelId"),
    systemPrompt: field(form, "systemPrompt"),
    codeVersion: readStudioEnv().AGENT_CODE_VERSION,
  };
}

/** Queue an interactive test without keeping the HTTP request open for the model. */
export async function startRun(form: FormData) {
  const session = await requireStaff("execute");
  const id = await withSpan("studio.submit_run", {}, () =>
    submitRun({
      input: field(form, "input"),
      requestKey: field(form, "requestKey"),
      ownerId: session.user.id,
      configuration: configuration(form),
    }),
  );
  logger.info({ run_id: id }, "Studio task queued");
  redirect(`/runs/${id}`);
}

/** Save an explicit expected outcome; production output is never treated as ground truth. */
export async function saveCase(form: FormData) {
  await requireStaff("author");
  const lines = (name: string) =>
    field(form, name)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  await authorCase({
    name: form.get("name"),
    dataset: form.get("dataset"),
    input: form.get("input"),
    sourceRunId: field(form, "sourceRunId").length
      ? field(form, "sourceRunId")
      : undefined,
    judge: field(form, "judgeRubric").trim()
      ? {
          provider: field(form, "judgeProvider"),
          modelId: field(form, "judgeModel"),
          rubric: field(form, "judgeRubric"),
          threshold: field(form, "judgeThreshold").trim()
            ? Number(field(form, "judgeThreshold"))
            : undefined,
        }
      : undefined,
    toolFixtures: JSON.parse(
      field(form, "toolFixtures").trim() || "{}",
    ) as unknown,
    assertions: [
      ...lines("contains").map((value) => ({ kind: "contains", value })),
      ...lines("notContains").map((value) => ({ kind: "not_contains", value })),
    ],
  });
  logger.info("Studio eval case saved");
  redirect("/cases");
}

/** Freeze selected cases and configuration before creating the experiment jobs. */
export async function startExperiment(form: FormData) {
  const session = await requireStaff("execute");
  const id = await withSpan("studio.launch_experiment", {}, () =>
    launchExperiment({
      name: field(form, "name"),
      ownerId: session.user.id,
      requestKey: field(form, "requestKey"),
      caseIds: form.getAll("caseId").map((value) => {
        if (typeof value !== "string") throw new Error("Invalid case ID");
        return value;
      }),
      repetitions: Number(form.get("repetitions") ?? 1),
      configuration: configuration(form),
    }),
  );
  logger.info({ experiment_id: id }, "Studio experiment queued");
  redirect(`/experiments/${id}`);
}

/** Playground requests share the same staff boundary and durable runtime as evals. */
export async function sendPlayground(
  input: string,
  requestKey: string,
  config: {
    provider: "gemini";
    modelId: string;
    systemPrompt: string;
  },
) {
  const session = await requireStaff("execute");
  const id = await withSpan("studio.playground.submit", {}, () =>
    submitRun({
      input,
      requestKey,
      ownerId: session.user.id,
      configuration: {
        ...config,
        codeVersion: readStudioEnv().AGENT_CODE_VERSION,
      },
    }),
  );
  return { id };
}

/** Read-only polling never creates a job; all studio data remains staff-only. */
export async function pollPlayground(id: string) {
  await requireStaff();
  const { z } = await import("zod/v4");
  const { getRun } = await import("@multitudes/db/runs");
  const run = await getRun(z.uuid().parse(id));
  if (!run) throw new Error("Run not found");
  return {
    id: run.id,
    input: run.input,
    status: run.status,
    output: run.output,
    error:
      run.status === "failed"
        ? "The task failed. Inspect its trajectory for details."
        : null,
  };
}
