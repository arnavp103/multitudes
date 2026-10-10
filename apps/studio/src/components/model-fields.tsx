import { Input } from "@multitudes/ui/input";

/** Native Google execution keeps the provider fixed; model IDs remain editable. */
export function ModelFields({
  modelId,
  judge = false,
}: {
  modelId: string;
  judge?: boolean;
}) {
  return (
    <div className="columns">
      <label>
        {judge ? "Judge provider" : "Provider"}
        <input
          type="hidden"
          name={judge ? "judgeProvider" : "provider"}
          value="gemini"
        />
        <Input value="Gemini AI Studio" readOnly />
      </label>
      <label>
        {judge ? "Judge model" : "Model ID"}
        <Input
          name={judge ? "judgeModel" : "modelId"}
          required={!judge}
          defaultValue={modelId}
          placeholder="Gemini model ID"
        />
      </label>
    </div>
  );
}
