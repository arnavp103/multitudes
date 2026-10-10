import { randomUUID } from "node:crypto";
import Link from "next/link";

import { canAccessStudio } from "@multitudes/auth/permissions";
import { listCases, listExperiments } from "@multitudes/db/runs";
import { Button } from "@multitudes/ui/button";
import { Input } from "@multitudes/ui/input";

import { ConfigurationFields } from "~/components/configuration-fields";
import { requireStaff } from "~/server/access";
import { startExperiment } from "~/server/actions";

export default async function ExperimentsPage() {
  const session = await requireStaff();
  const [cases, experiments] = await Promise.all([
    listCases(),
    listExperiments(),
  ]);
  return (
    <>
      <p className="eyebrow">MEASURE / REGRESSIONS</p>
      <h1>Experiments</h1>
      <div className="workspace">
        <section className="panel">
          <h2>History</h2>
          {experiments.map((item) => (
            <div className="event" key={item.id}>
              <Link href={`/experiments/${item.id}`}>{item.name}</Link>
              <p className="muted">
                {item.configuration.modelId} · {item.createdAt.toLocaleString()}
              </p>
            </div>
          ))}
          {!experiments.length && (
            <p className="empty">
              Run your cases against a frozen agent configuration.
            </p>
          )}
        </section>
        <section className="panel">
          <h2>New experiment</h2>
          {canAccessStudio(session.user.role, "execute") && (
            <form action={startExperiment}>
              <input type="hidden" name="requestKey" value={randomUUID()} />
              <label>
                Name
                <Input name="name" required maxLength={200} />
              </label>
              <ConfigurationFields />
              <fieldset>
                <legend>Cases</legend>
                {cases.map((item) => (
                  <label className="check" key={item.id}>
                    <input type="checkbox" name="caseId" value={item.id} />
                    {item.dataset} / {item.name}
                  </label>
                ))}
                {!cases.length && (
                  <Link href="/cases/new">Create a case first</Link>
                )}
              </fieldset>
              <label>
                Trials per case
                <Input
                  name="repetitions"
                  type="number"
                  min={1}
                  max={5}
                  defaultValue={1}
                />
              </label>
              <Button disabled={!cases.length}>Queue experiment</Button>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
