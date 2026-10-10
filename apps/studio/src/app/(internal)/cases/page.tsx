import Link from "next/link";

import { listCases } from "@multitudes/db/runs";
import { buttonVariants } from "@multitudes/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@multitudes/ui/table";

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
        <Link className={buttonVariants()} href="/cases/new">
          Author a case
        </Link>
      </div>
      <p className="muted">
        Cases are immutable. Save a new case to revise an expectation without
        changing past experiments.
      </p>
      <section className="panel">
        {cases.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Case</TableHead>
                <TableHead>Dataset</TableHead>
                <TableHead>Assertions</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <strong>{item.name}</strong>
                    <details>
                      <summary>Input and expectations</summary>
                      <pre>{item.input}</pre>
                      <pre>
                        {JSON.stringify(
                          {
                            assertions: item.assertions,
                            judge: item.judge,
                            toolFixtures: item.toolFixtures,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  </TableCell>
                  <TableCell>{item.dataset}</TableCell>
                  <TableCell>
                    {item.assertions.length}
                    {item.judge && " + LLM judge"}
                  </TableCell>
                  <TableCell>
                    {item.sourceRunId ? (
                      <Link href={`/runs/${item.sourceRunId}`}>
                        Production trajectory
                      </Link>
                    ) : (
                      "Authored"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="empty">
            Author a case or promote a production run to get started.
          </p>
        )}
      </section>
    </>
  );
}
