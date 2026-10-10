import { SYSTEM_PROMPT } from "@multitudes/agent/prompts";
import { Textarea } from "@multitudes/ui/textarea";

import { readStudioEnv } from "~/env";
import { ModelFields } from "./model-fields";

/** Configuration is frozen on each run and experiment for later comparison. */
export function ConfigurationFields() {
  const env = readStudioEnv();
  return (
    <>
      <ModelFields modelId={env.AGENT_MODEL_ID} />
      <label>
        System prompt
        <Textarea
          name="systemPrompt"
          required
          rows={4}
          defaultValue={SYSTEM_PROMPT}
        />
      </label>
      <p className="muted">
        Worker revision: <code>{env.AGENT_CODE_VERSION}</code>
      </p>
    </>
  );
}
