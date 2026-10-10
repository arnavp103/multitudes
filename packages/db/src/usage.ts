import { eq } from "drizzle-orm";

import { ModelCall } from "./agent-schema";
import { db } from "./client";
import { withAttempt } from "./runs";

export type CallStart = Pick<
  typeof ModelCall.$inferInsert,
  "id" | "runId" | "attempt" | "purpose" | "provider" | "modelId" | "pricing"
>;
export type CallFinish = Pick<
  typeof ModelCall.$inferInsert,
  "usage" | "estimatedCostUsd" | "durationMs" | "errorType"
> & { status: "completed" | "failed" };
/** Fail before spending tokens when the durable ledger or attempt lease is unavailable. */
export async function startModelCall(call: CallStart) {
  await withAttempt(call.runId, call.attempt, async (tx) => {
    await tx.insert(ModelCall).values({ ...call, status: "started" });
  });
}
/** Preserve actual spend even if the enclosing run attempt has since been superseded. */
export async function finishModelCall(id: string, result: CallFinish) {
  await db
    .update(ModelCall)
    .set({ ...result, finishedAt: new Date() })
    .where(eq(ModelCall.id, id));
}
