import Link from "next/link";

import { listRuns } from "@multitudes/db/runs";

import { ConfigurationFields } from "~/components/configuration-fields";
import { LiveRefresh } from "~/components/live-refresh";
import { requireStaff } from "~/server/access";
import { startRun } from "~/server/actions";

export default async function RunsPage() {
  await requireStaff();
  const runs = await listRuns();
  return (
    <>
      <p className="eyebrow">OBSERVE / ITERATE</p>
      <h1>Agent runs</h1>
      <p className="muted">
        Durable trajectories from your shared production and evaluation runtime.
      </p>
      <div className="workspace">
        <section className="panel">
          <div className="section-title">
            <h2>Recent runs</h2>
            <LiveRefresh
              active={runs.some(
                (run) => run.status === "queued" || run.status === "running",
              )}
            />
          </div>
          {runs.length ? (
            <table>
              <thead>
                <tr>
                  <th>Input</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <Link href={`/runs/${run.id}`}>
                        {run.input.slice(0, 90)}
                      </Link>
                    </td>
                    <td>{run.mode}</td>
                    <td>
                      <span className={`status ${run.status}`}>
                        {run.status}
                      </span>
                    </td>
                    <td>{run.createdAt.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty">
              No runs yet. Submit a task to capture your first trajectory.
            </p>
          )}
        </section>
        <section className="panel">
          <h2>Run a task</h2>
          <form action={startRun}>
            <label>
              Task
              <textarea
                name="input"
                rows={4}
                required
                maxLength={64000}
                placeholder="What should the agent do?"
              />
            </label>
            <ConfigurationFields />
            <button>Queue run</button>
          </form>
        </section>
      </div>
    </>
  );
}
