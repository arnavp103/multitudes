"use client";

import { useState } from "react";

import { Input } from "@multitudes/ui/input";

type Provider = "gemini" | "deepseek" | "bedrock" | "openai";

/** Keep provider and model defaults paired while allowing explicit model overrides. */
export function ModelFields({
  provider,
  modelId,
  judge = false,
}: {
  provider: Provider;
  modelId: string;
  judge?: boolean;
}) {
  const [selected, setSelected] = useState(provider);
  const [model, setModel] = useState(modelId);
  return (
    <div className="columns">
      <label>
        {judge ? "Judge provider" : "Provider"}
        <select
          name={judge ? "judgeProvider" : "provider"}
          value={selected}
          onChange={(event) => {
            const next = event.target.value as Provider;
            setSelected(next);
            setModel(
              next === "gemini"
                ? "gemini-3.8-flash"
                : next === "deepseek"
                  ? "deepseek-flash"
                  : "",
            );
          }}
        >
          <option value="gemini">Gemini AI Studio</option>
          <option value="deepseek">DeepSeek</option>
          {!judge && <option value="bedrock">AWS Bedrock</option>}
          {!judge && <option value="openai">OpenAI</option>}
        </select>
      </label>
      <label>
        {judge ? "Judge model" : "Model ID"}
        <Input
          name={judge ? "judgeModel" : "modelId"}
          required={!judge}
          value={model}
          onChange={(event) => setModel(event.target.value)}
          placeholder="Provider model ID"
        />
      </label>
    </div>
  );
}
