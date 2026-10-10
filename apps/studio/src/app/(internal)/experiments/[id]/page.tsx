import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod/v4";

import { getExperimentRuns, listExperiments } from "@multitudes/db/runs";

import { LiveRefresh } from "~/components/live-refresh";
import { requireStaff } from "~/server/access";

export default async function ExperimentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ compare?: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { compare } = await searchParams;
  const [runs, experiments, baseline] = await Promise.all([
    getExperimentRuns(id),
    listExperiments(),
    compare && z.uuid().safeParse(compare).success
      ? getExperimentRuns(compare)
      : Promise.resolve([]),
  ]);
  if (!runs.length) notFound();
  const passed = runs.filter((item) => item.score?.passed).length;
  const pending = runs.filter(
    ({ run }) => run.status === "queued" || run.status === "running",
  ).length;
  return (
    <>
      <div className="section-title">
        <div>
          <p className="eyebrow">EXPERIMENT / RESULTS</p>
          <h1>
            {experiments.find((item) => item.id === id)?.name ?? "Experiment"}
          </h1>
        </div>
        <LiveRefresh active={pending > 0} />
      </div>
      <div className="facts">
        <strong>
          {passed} / {runs.length} passed
        </strong>
        <span>{pending} pending</span>
        <span>
          {runs.filter(({ run }) => run.status === "failed").length} execution
          failures
        </span>
      </div>
      <form className="comparison">
        <label>
          Compare with
          <select name="compare" defaultValue={compare ?? ""}>
            <option value="">No baseline</option>
            {experiments
              .filter((item) => item.id !== id)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
        </label>
        <button className="secondary">Compare</button>
      </form>
      <section className="panel">
        <table>
          <thead>
            <tr>
              <th>Case / trial</th>
              <th>Execution</th>
              <th>Score</th>
              <th>Baseline passes</th>
              <th>Output</th>
            </tr>
          </thead>
          <tbody>
            {runs.map(({ run, score }) => {
              const matches = baseline.filter(
                (item) => item.run.caseId === run.caseId,
              );
              return (
                <tr key={run.id}>
                  <td>
                    <Link href={`/runs/${run.id}`}>
                      {run.input.slice(0, 70)}
                    </Link>
                  </td>
                  <td>
                    <span className={`status ${run.status}`}>{run.status}</span>
                  </td>
                  <td>
                    {score ? (
                      <details>
                        <summary>{score.passed ? "Pass" : "Fail"}</summary>
                        <pre>{JSON.stringify(score.details, null, 2)}</pre>
                      </details>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {matches.length
                      ? `${matches.filter((item) => item.score?.passed).length}/${matches.length}`
                      : "—"}
                  </td>
                  <td>
                    <pre>{run.output ?? run.error ?? "Waiting for worker"}</pre>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
