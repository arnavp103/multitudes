"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { submitRun } from "@multitudes/agent";
import { authorCase, launchExperiment } from "@multitudes/evals";
import { withSpan } from "@multitudes/observability/context";

import { readStudioEnv } from "~/env";
import { requireStaff, studioAuth } from "./access";

/** Start OAuth on the studio origin, without exposing provider credentials. */
export async function signIn() {
  const result = await studioAuth().api.signInSocial({
    headers: await headers(),
    body: { provider: "discord", callbackURL: "/" },
  });
  if (result.url) redirect(result.url);
}

function field(form: FormData, name: string) {
  const value = form.get(name);
  if (typeof value !== "string") throw new Error(`Missing text field: ${name}`);
  return value;
}

function configuration(form: FormData) {
  return {
    provider:
      form.get("provider") === "openai"
        ? ("openai" as const)
        : ("bedrock" as const),
    modelId: field(form, "modelId"),
    systemPrompt: field(form, "systemPrompt"),
    codeVersion: readStudioEnv().AGENT_CODE_VERSION,
  };
}

/** Queue an interactive test without keeping the HTTP request open for the model. */
export async function startRun(form: FormData) {
  await requireStaff();
  const id = await withSpan("studio.submit_run", {}, () =>
    submitRun({
      input: field(form, "input"),
      configuration: configuration(form),
    }),
  );
  redirect(`/runs/${id}`);
}

/** Save an explicit expected outcome; production output is never treated as ground truth. */
export async function saveCase(form: FormData) {
  await requireStaff();
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
    assertions: [
      ...lines("contains").map((value) => ({ kind: "contains", value })),
      ...lines("notContains").map((value) => ({ kind: "not_contains", value })),
    ],
  });
  redirect("/cases");
}

/** Freeze selected cases and configuration before creating the experiment jobs. */
export async function startExperiment(form: FormData) {
  await requireStaff();
  const id = await withSpan("studio.launch_experiment", {}, () =>
    launchExperiment({
      name: field(form, "name"),
      caseIds: form.getAll("caseId").map((value) => {
        if (typeof value !== "string") throw new Error("Invalid case ID");
        return value;
      }),
      repetitions: Number(form.get("repetitions") ?? 1),
      configuration: configuration(form),
    }),
  );
  redirect(`/experiments/${id}`);
}
