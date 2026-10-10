import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod/v4";

import { getRun, getRunEvents } from "@multitudes/db/runs";
import { RunConversation } from "@multitudes/ui/agent-chat";
import { buttonVariants } from "@multitudes/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@multitudes/ui/tabs";

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
          <Link
            className={buttonVariants()}
            href={`/cases/new?sourceRunId=${id}`}
          >
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
      <Tabs defaultValue="conversation">
        <TabsList className="mb-5">
          <TabsTrigger value="conversation">Conversation</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
        </TabsList>
        <TabsContent value="conversation" className="panel">
          <RunConversation
            run={{
              id: run.id,
              input: run.input,
              status: run.status,
              output: run.output,
              error: run.error,
            }}
          />
        </TabsContent>
        <TabsContent value="configuration" className="panel">
          <pre>{JSON.stringify(run.configuration, null, 2)}</pre>
        </TabsContent>
      </Tabs>
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
