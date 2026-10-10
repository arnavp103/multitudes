import { z } from "zod/v4";

import { getRun } from "@multitudes/db/runs";
import { Button } from "@multitudes/ui/button";
import { Input } from "@multitudes/ui/input";
import { Textarea } from "@multitudes/ui/textarea";

import { ModelFields } from "~/components/model-fields";
import { requireStaff } from "~/server/access";
import { saveCase } from "~/server/actions";

export default async function NewCasePage({
  searchParams,
}: {
  searchParams: Promise<{ sourceRunId?: string }>;
}) {
  await requireStaff("author");
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
          <Input type="hidden" name="sourceRunId" value={source?.id ?? ""} />
          <div className="columns">
            <label>
              Name
              <Input name="name" required maxLength={200} />
            </label>
            <label>
              Dataset
              <Input
                name="dataset"
                defaultValue="regression"
                required
                maxLength={100}
              />
            </label>
          </div>
          <label>
            Input
            <Textarea
              name="input"
              defaultValue={source?.input}
              required
              rows={6}
              maxLength={64000}
            />
          </label>
          <label>
            Output must contain
            <Textarea
              name="contains"
              rows={3}
              placeholder="One required substring per line"
            />
          </label>
          <label>
            Output must not contain
            <Textarea
              name="notContains"
              rows={3}
              placeholder="One forbidden substring per line"
            />
          </label>
          <label>
            Task fixtures (JSON)
            <Textarea
              name="toolFixtures"
              defaultValue="{}"
              rows={5}
              maxLength={100_000}
            />
            <span className="muted">
              Map task UUIDs to status, attempts, and output. Missing IDs return
              “Task not found”. Eval tools never read production tasks.
            </span>
          </label>
          <fieldset className="max-h-none! space-y-4">
            <legend>LLM judge (optional)</legend>
            <label>
              Rubric
              <Textarea
                name="judgeRubric"
                rows={4}
                maxLength={8000}
                placeholder="What makes this answer correct and useful? Leave blank for assertions only."
              />
            </label>
            <ModelFields judge modelId="gemini-3.8-flash" />
            <label>
              Pass threshold (0–1)
              <Input
                name="judgeThreshold"
                type="number"
                min={0}
                max={1}
                step={0.05}
                defaultValue={0.8}
              />
            </label>
          </fieldset>
          <p className="muted">
            At least one assertion or a judge rubric is required. Matching is
            case-sensitive. This first version evaluates text outputs.
          </p>
          <Button>Save immutable case</Button>
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
