import { isDeepStrictEqual } from "node:util";
import { eq } from "drizzle-orm";

import type { EventInput, EventRecord } from "@multitudes/events";
import { emit } from "@multitudes/events";

import { Event } from "./agent-schema";
import { db } from "./client";

/** Adapt an existing transaction. Call publish only after its COMMIT succeeds. */
export function transactionEvents(tx: Pick<typeof db, "insert" | "select">) {
  const notifications: (() => void)[] = [];
  const insert = async (event: EventRecord) => {
    const [inserted] = await tx
      .insert(Event)
      .values(event)
      .onConflictDoNothing({ target: Event.idempotencyKey })
      .returning();
    if (inserted) return { event: inserted, inserted: true };
    if (!event.idempotencyKey) throw new Error("Event insertion failed");
    const [existing] = await tx
      .select()
      .from(Event)
      .where(eq(Event.idempotencyKey, event.idempotencyKey));
    if (!existing || !isDeepStrictEqual(identity(existing), identity(event)))
      throw new Error(
        "Event idempotency key was already used for a different fact",
      );
    return { event: existing, inserted: false };
  };
  return {
    emit: (input: EventInput) =>
      emit(
        { insert, afterCommit: (notify) => notifications.push(notify) },
        input,
      ),
    publish: () => {
      for (const notify of notifications.splice(0)) notify();
    },
  };
}

/** Event identity excludes occurrence metadata so a replay returns the original immutable row. */
function identity(event: EventRecord) {
  return {
    name: event.name,
    version: event.version,
    actorId: event.actorId,
    subjectType: event.subjectType,
    subjectId: event.subjectId,
    runId: event.runId,
    payload: event.payload,
  };
}

/** Commit business state and facts together, publishing telemetry only after a successful commit. */
export async function withEvents<T>(
  fn: (
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    emit: ReturnType<typeof transactionEvents>["emit"],
  ) => Promise<T>,
) {
  let publish = () => {
    /* Nothing is committed yet. */
  };
  const result = await db.transaction(async (tx) => {
    const events = transactionEvents(tx);
    publish = events.publish;
    return fn(tx, events.emit);
  });
  publish();
  return result;
}
