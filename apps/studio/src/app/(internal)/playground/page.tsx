import { Playground } from "~/components/playground";
import { readStudioEnv } from "~/env";
import { requireStaff } from "~/server/access";

export default async function PlaygroundPage() {
  await requireStaff();
  const env = readStudioEnv();
  return (
    <>
      <p className="eyebrow">Explore / refine</p>
      <h1>Playground</h1>
      <p className="muted mb-8">
        Try a prompt, inspect its trajectory, and turn a useful example into an
        eval.
      </p>
      <Playground provider={env.AGENT_PROVIDER} modelId={env.AGENT_MODEL_ID} />
    </>
  );
}
