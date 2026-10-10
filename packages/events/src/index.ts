import { isSpanContextValid, trace } from "@opentelemetry/api";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod/v4";

import { createLogger } from "@multitudes/observability/logger";

import type { EventInput } from "./registry";
import { registry } from "./registry";

export type { EventInput } from "./registry";

const envelope = z.strictObject({
  name: z.string().min(1),
  version: z.number().int().positive().max(32767),
  subjectType: z.string().min(1),
  subjectId: z.string().min(1).max(512),
  actorId: z.string().min(1).max(512).nullable(),
  runId: z.uuid().nullable().default(null),
  traceId: z
    .string()
    .regex(/^[a-f0-9]{32}$/)
    .refine((id) => !/^0+$/.test(id))
    .nullable()
    .optional(),
  idempotencyKey: z.string().min(1).max(512).nullable().default(null),
  payload: z.record(z.string(), z.unknown()),
});

export interface EventRecord {
  id: string;
  name: string;
  version: number;
  occurredAt: Date;
  actorId: string | null;
  subjectType: string;
  subjectId: string;
  runId: string | null;
  traceId: string | null;
  payload: Record<string, unknown>;
  idempotencyKey: string | null;
}

/** Transaction port. The DB adapter owns insertion, deduplication, and commit notification. */
export interface EventTransaction {
  insert: (
    event: EventRecord,
  ) => Promise<{ event: EventRecord; inserted: boolean }>;
  afterCommit: (notify: () => void) => void;
}

/** Validate all runtime input, including JavaScript callers, before touching storage. */
export function prepareEvent(input: EventInput): EventRecord {
  const value = envelope.parse(input);
  const key = `${value.name}@${value.version}`;
  if (!Object.hasOwn(registry, key))
    throw new Error("Unknown event name or version");
  const definition = registry[key as keyof typeof registry];
  if (value.subjectType !== definition.subjectType)
    throw new Error("Event subject type mismatch");
  if (value.subjectType === "run" && value.runId !== value.subjectId)
    throw new Error("Run events require the matching run foreign key");
  const span = trace.getActiveSpan()?.spanContext();
  return {
    ...value,
    id: uuidv7(),
    occurredAt: new Date(),
    traceId:
      value.traceId === undefined
        ? span && isSpanContextValid(span)
          ? span.traceId
          : null
        : value.traceId,
    payload: definition.payload.parse(value.payload),
  };
}

/** Insert a validated business fact into the caller's transaction; never open another connection. */
export async function emit(transaction: EventTransaction, input: EventInput) {
  const result = await transaction.insert(prepareEvent(input));
  if (result.inserted)
    transaction.afterCommit(() => publishCommittedEvent(result.event));
  return result.event;
}

/** Lossy post-commit correlation. Telemetry cannot turn a committed mutation into a reported failure. */
function publishCommittedEvent(event: EventRecord) {
  try {
    const attributes = {
      "event.name": event.name,
      "event.version": event.version,
      "event.id": event.id,
      "event.subject_type": event.subjectType,
      "event.subject_id": event.subjectId,
    };
    trace.getActiveSpan()?.addEvent(event.name, attributes);
    createLogger("multitudes-events").info(
      {
        ...attributes,
        trace_id: event.traceId ?? undefined,
        run_id: event.runId ?? undefined,
      },
      event.name,
    );
  } catch {
    // The durable row is already committed; exporters and stdout are best effort.
  }
}
