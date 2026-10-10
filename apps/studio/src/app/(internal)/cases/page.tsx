import Link from "next/link";

import { listCases } from "@multitudes/db/runs";

import { requireStaff } from "~/server/access";

export default async function CasesPage() {
  await requireStaff();
  const cases = await listCases();
  return (
    <>
      <div className="section-title">
        <div>
          <p className="eyebrow">CURATE / EXPECTATIONS</p>
          <h1>Eval cases</h1>
        </div>
        <Link className="button" href="/cases/new">
          Author a case
        </Link>
      </div>
      <p className="muted">
        Cases are immutable. Save a new case to revise an expectation without
        changing past experiments.
      </p>
      <section className="panel">
        {cases.length ? (
          <table>
            <thead>
              <tr>
                <th>Case</th>
                <th>Dataset</th>
                <th>Assertions</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                    <details>
                      <summary>Input and expectations</summary>
                      <pre>{item.input}</pre>
                      <pre>{JSON.stringify(item.assertions, null, 2)}</pre>
                    </details>
                  </td>
                  <td>{item.dataset}</td>
                  <td>{item.assertions.length}</td>
                  <td>
                    {item.sourceRunId ? (
                      <Link href={`/runs/${item.sourceRunId}`}>
                        Production trajectory
                      </Link>
                    ) : (
                      "Authored"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="empty">
            Author a case or promote a production run to get started.
          </p>
        )}
      </section>
    </>
  );
}
