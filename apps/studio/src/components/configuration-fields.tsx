import { readStudioEnv } from "~/env";

/** Configuration is frozen on each run and experiment for later comparison. */
export function ConfigurationFields() {
  const env = readStudioEnv();
  return (
    <>
      <div className="columns">
        <label>
          Provider
          <select name="provider" defaultValue={env.AGENT_PROVIDER}>
            <option value="bedrock">AWS Bedrock</option>
            <option value="openai">OpenAI</option>
          </select>
        </label>
        <label>
          Model ID
          <input
            name="modelId"
            required
            defaultValue={env.AGENT_MODEL_ID}
            placeholder="Provider model ID"
          />
        </label>
      </div>
      <label>
        System prompt
        <textarea
          name="systemPrompt"
          required
          rows={4}
          defaultValue="You are a helpful assistant. Answer accurately and concisely."
        />
      </label>
      <p className="muted">
        Worker revision: <code>{env.AGENT_CODE_VERSION}</code>
      </p>
    </>
  );
}
