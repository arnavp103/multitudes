import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod/v4";

import { getRun, getRunEvents } from "@multitudes/db/runs";

import { LiveRefresh } from "~/components/live-refresh";
import { requireStaff } from "~/server/access";

export default async function RunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [run, events] = await Promise.all([getRun(id), getRunEvents(id)]);
  if (!run) notFound();
  return (
    <>
      <div className="section-title">
        <div>
          <p className="eyebrow">RUN / {run.mode}</p>
          <h1>Trajectory</h1>
          <code className="muted">{id}</code>
        </div>
        <div className="actions">
          <LiveRefresh
            active={run.status === "queued" || run.status === "running"}
          />
          <Link className="button" href={`/cases/new?sourceRunId=${id}`}>
            Create eval case
          </Link>
        </div>
      </div>
      <div className="facts">
        <span className={`status ${run.status}`}>{run.status}</span>
        <span>{run.configuration.modelId}</span>
        <span>{run.attempts} attempt(s)</span>
        <span>Revision {run.configuration.codeVersion}</span>
      </div>
      <section className="panel">
        <h2>Input</h2>
        <pre>{run.input}</pre>
        {run.output !== null && (
          <>
            <h2>Output</h2>
            <pre>{run.output}</pre>
          </>
        )}
        {run.error && <p className="error">{run.error}</p>}
        <details>
          <summary>Frozen configuration</summary>
          <pre>{JSON.stringify(run.configuration, null, 2)}</pre>
        </details>
      </section>
      <section className="panel">
        <h2>
          Event timeline <span className="muted">{events.length}</span>
        </h2>
        {events.map((event) => (
          <details className="event" key={event.id}>
            <summary>
              <strong>{event.type}</strong>
              <time>{event.createdAt.toISOString()}</time>
            </summary>
            <pre>{JSON.stringify(event.payload, null, 2)}</pre>
          </details>
        ))}
      </section>
    </>
  );
}
