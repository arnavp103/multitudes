import { randomUUID } from "node:crypto";
import Link from "next/link";

import { canAccessStudio } from "@multitudes/auth/permissions";
import { listRuns } from "@multitudes/db/runs";
import { Button } from "@multitudes/ui/button";
import { Metric } from "@multitudes/ui/metric";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@multitudes/ui/table";
import { Textarea } from "@multitudes/ui/textarea";

import { ConfigurationFields } from "~/components/configuration-fields";
import { LiveRefresh } from "~/components/live-refresh";
import { requireStaff } from "~/server/access";
import { startRun } from "~/server/actions";

export default async function RunsPage() {
  const session = await requireStaff();
  const runs = await listRuns();
  return (
    <>
      <p className="eyebrow">Observe / iterate</p>
      <h1>Agent runs</h1>
      <p className="muted">
        Durable trajectories from your shared production and evaluation runtime.
      </p>
      <div className="mt-(--tc-stack) grid gap-3 sm:grid-cols-3">
        {[
          {
            title: "Recent runs",
            value: runs.length,
            detail: "Latest 100 trajectories",
          },
          {
            title: "In progress",
            value: runs.filter(
              (run) => run.status === "queued" || run.status === "running",
            ).length,
            detail: "Queued and running",
          },
          {
            title: "Needs attention",
            value: runs.filter((run) => run.status === "failed").length,
            detail: "Failed runs in this window",
          },
        ].map((item) => (
          <Metric
            key={item.title}
            label={item.title}
            value={item.value}
            detail={item.detail}
          />
        ))}
      </div>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Input</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      <Link href={`/runs/${run.id}`}>
                        {run.input.slice(0, 90)}
                      </Link>
                    </TableCell>
                    <TableCell>{run.mode}</TableCell>
                    <TableCell>
                      <span className={`status ${run.status}`}>
                        {run.status}
                      </span>
                    </TableCell>
                    <TableCell>{run.createdAt.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="empty">
              No runs yet. Submit a task to capture your first trajectory.
            </p>
          )}
        </section>
        <section className="panel">
          <h2>Run a task</h2>
          {canAccessStudio(session.user.role, "execute") && (
            <form action={startRun}>
              <input type="hidden" name="requestKey" value={randomUUID()} />
              <label>
                Task
                <Textarea
                  name="input"
                  rows={4}
                  required
                  maxLength={64000}
                  placeholder="What should the agent do?"
                />
              </label>
              <ConfigurationFields />
              <Button>Queue run</Button>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
