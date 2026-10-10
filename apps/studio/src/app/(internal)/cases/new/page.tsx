import { z } from "zod/v4";

import { getRun } from "@multitudes/db/runs";

import { requireStaff } from "~/server/access";
import { saveCase } from "~/server/actions";

export default async function NewCasePage({
  searchParams,
}: {
  searchParams: Promise<{ sourceRunId?: string }>;
}) {
  await requireStaff();
  const { sourceRunId } = await searchParams;
  const source =
    sourceRunId && z.uuid().safeParse(sourceRunId).success
      ? await getRun(sourceRunId)
      : undefined;
  return (
    <>
      <p className="eyebrow">CURATE / NEW CASE</p>
      <h1>Define a good outcome</h1>
      <p className="muted">
        Review and sanitize production input before saving. Write your
        expectations independently of the original answer.
      </p>
      <section className="panel narrow">
        <form action={saveCase}>
          <input type="hidden" name="sourceRunId" value={source?.id ?? ""} />
          <div className="columns">
            <label>
              Name
              <input name="name" required maxLength={200} />
            </label>
            <label>
              Dataset
              <input
                name="dataset"
                defaultValue="regression"
                required
                maxLength={100}
              />
            </label>
          </div>
          <label>
            Input
            <textarea
              name="input"
              defaultValue={source?.input}
              required
              rows={6}
              maxLength={64000}
            />
          </label>
          <label>
            Output must contain
            <textarea
              name="contains"
              rows={3}
              placeholder="One required substring per line"
            />
          </label>
          <label>
            Output must not contain
            <textarea
              name="notContains"
              rows={3}
              placeholder="One forbidden substring per line"
            />
          </label>
          <p className="muted">
            At least one assertion is required. Matching is case-sensitive. This
            first version evaluates text outputs.
          </p>
          <button>Save immutable case</button>
        </form>
        {source?.output && (
          <details>
            <summary>Original output — reference only</summary>
            <pre>{source.output}</pre>
          </details>
        )}
      </section>
    </>
  );
}
